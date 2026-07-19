from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from pydantic import BaseModel
from typing import Dict, Any, List
from ai_prediction import compare_models
from text_generation import gigachat_text, gigachat_analyze_news
from news_parser import get_news_summary_raw
import json
import re
import requests
from fastapi.middleware.cors import CORSMiddleware
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="University Analytics AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class MultiPredictionRequest(BaseModel):
    data: dict[str, dict[str, dict[str, float]]]
    n_periods: int = 12


@app.post("/predict")
def predict(payload: MultiPredictionRequest):
    try:
        result = {}
        for metric_name, metric_data in payload.data.items():
            df = compare_models(metric_data, payload.n_periods)
            if df is None or df.empty:
                logger.warning(f"compare_models вернул None или пустой DF для {metric_name}")
                result[metric_name] = {"models": [], "best_model": None}
                continue

            models_output = []
            for rank, (_, row) in enumerate(df.iterrows(), start=1):
                forecast = row["forecast"]
                forecast_json = (
                    {
                        str(k.date()): float(v)
                        for k, v in forecast.items()
                    }
                    if forecast is not None
                    else None
                )
                models_output.append({
                    "name": row["model"],
                    "metrics": {
                        "MAE": float(row["MAE"]) if row["MAE"] == row["MAE"] else None,
                        "RMSE": float(row["RMSE"]) if row["RMSE"] == row["RMSE"] else None,
                        "MAPE": float(row["MAPE"]) if row["MAPE"] == row["MAPE"] else None,
                        "time_sec": float(row["time_sec"])
                    },
                    "forecast": forecast_json,
                    "best": rank
                })
            result[metric_name] = {
                "models": models_output,
                "best_model": models_output[0]["name"] if models_output else None
            }
        return result
    except Exception as e:
        logger.error(f"Ошибка в /predict: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _safe_send(websocket: WebSocket, payload: dict) -> bool:
    """Отправляет JSON, только если соединение ещё живо.

    Фронтенд переоткрывает WebSocket при каждой смене фильтра (регион/период)
    и дважды в dev-режиме React StrictMode. Старый сокет при этом закрывается
    клиентом, а сервер продолжает слать статусы — раньше это давало
    `RuntimeError: Cannot call "send" once a close message has been sent`
    и роняло обработчик. Теперь такой send просто тихо пропускается, а вызвавший
    код по возвращённому False понимает, что клиент ушёл, и прекращает работу."""
    if websocket.application_state != WebSocketState.CONNECTED:
        return False
    try:
        await websocket.send_text(json.dumps(payload))
        return True
    except Exception as e:  # ConnectionClosedOK / RuntimeError и т.п.
        logger.info(f"WS send пропущен (клиент отключился): {e}")
        return False


def _norm_title(title: str) -> str:
    """Нормализует заголовок для сопоставления: нижний регистр, «ё»→«е»,
    только буквы/цифры. Нужно, чтобы найти исходную новость по заголовку,
    который вернул GigaChat (он может слегка переформатировать текст)."""
    return re.sub(r"[^a-zа-я0-9]+", "", (title or "").lower().replace("ё", "е"))


def _restore_source_links(analyzed: list, all_news: list) -> None:
    """Восстанавливает реальные url/source/date в новостях от GigaChat.

    В GigaChat уходит только текст (заголовок/источник/дата/резюме), без ссылок,
    поэтому модель возвращает пустые или выдуманные url — и значок «перейти»
    вёл в никуда (пустой href = текущая страница). Сопоставляем каждую
    выбранную новость с исходной по заголовку и подставляем настоящую ссылку."""
    by_title = {}
    for n in all_news:
        key = _norm_title(n.get("title", ""))
        if key:
            by_title.setdefault(key, n)

    for item in analyzed:
        t = _norm_title(item.get("title", ""))
        orig = by_title.get(t)
        if orig is None and t:
            # Частичное совпадение — GigaChat мог укоротить заголовок.
            for key, n in by_title.items():
                if t in key or key in t:
                    orig = n
                    break
        if orig:
            # url у модели ненадёжен — всегда берём реальный из RSS.
            item["url"] = orig.get("url", "")
            item["source"] = orig.get("source", item.get("source", ""))
            if not item.get("date"):
                item["date"] = orig.get("date", "")
        elif not str(item.get("url", "")).startswith(("http://", "https://")):
            # Исходник не нашёлся и ссылка не похожа на настоящую — очищаем,
            # чтобы фронт не рисовал битую ссылку на текущую страницу.
            item["url"] = ""


@app.websocket("/ws/news")
async def websocket_news(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket /ws/news connected")
    try:
        data = await websocket.receive_text()
        params = json.loads(data)
        subject = params.get('subject', '')
        period = params.get('period', 90)

        if not await _safe_send(websocket, {"phase": "START", "message": "Начинаем сбор новостей..."}):
            return

        indicators = get_indicators_from_java()
        if not await _safe_send(websocket, {"phase": "INDICATORS",
                                            "message": f"Получено {len(indicators)} показателей"}):
            return

        # Статусы парсинга шлём тем же безопасным каналом.
        async def status_cb(text: str):
            if websocket.application_state == WebSocketState.CONNECTED:
                try:
                    await websocket.send_text(text)
                except Exception:
                    pass

        all_news = await get_news_summary_raw(
            subject, period, indicators,
            status_callback=status_cb
        )

        if not all_news:
            await _safe_send(websocket, {"phase": "DONE", "message": "Новостей не найдено", "data": []})
            return

        if not await _safe_send(websocket, {"phase": "FOUND", "message": f"Найдено {len(all_news)} новостей"}):
            return

        if not await _safe_send(websocket,
                                {"phase": "ANALYZING", "message": "Анализируем важность новостей через AI..."}):
            return

        top_news = all_news[:20]
        news_text = "Вот список новостей:\n\n"
        for i, news in enumerate(top_news, 1):
            news_text += f"{i}. {news['title']} ({news['source']}, {news['date']})\n"
            news_text += f"   {news['summary'][:200]}...\n\n"

        analyzed = gigachat_analyze_news(news_text, subject, indicators)

        if analyzed:
            _restore_source_links(analyzed, all_news)
            await _safe_send(websocket, {"phase": "DONE",
                                         "message": f"Выбрано {len(analyzed)} самых важных новостей",
                                         "data": analyzed})
        else:
            await _safe_send(websocket, {"phase": "DONE",
                                         "message": f"GigaChat недоступен, возвращаем {len(top_news[:5])} свежих новостей",
                                         "data": top_news[:5]})

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected")
    except Exception as e:
        logger.error(f"Ошибка websocket_news: {e}")
        await _safe_send(websocket, {"phase": "ERROR", "message": str(e)})
    finally:
        if websocket.application_state == WebSocketState.CONNECTED:
            try:
                await websocket.close()
            except Exception:
                pass


def get_indicators_from_java() -> List[str]:
    """Фолбэк: тянет показатели из Java, если фронт/бэкенд не передал их в
    теле запроса. Основной путь — indicators приходят в запросе (см.
    NewsService.java), этот вызов нужен лишь для WebSocket-пути и как запас."""
    try:
        response = requests.get("http://localhost:8080/api/indicators", timeout=5)
        if response.status_code == 200:
            return response.json()
        # Логируем статус и тело — тихий [] раньше незаметно отключал фильтр.
        logger.warning(f"Java /api/indicators вернул {response.status_code}: {response.text[:200]}")
    except Exception as e:
        logger.error(f"Ошибка получения показателей из Java: {e}")
    return []


@app.post("/generate-text")
def generate_text(data: Dict[str, Any]):
    try:
        context = f"Данные по региону {data.get('subject')}. Тренд: {data.get('trend')}. Прогноз: {data.get('forecast')}"
        text = gigachat_text(context)
        return {"summary": text}
    except Exception as e:
        return {"summary": f"Ошибка: {str(e)}"}


@app.post("/generate-news")
async def generate_news(data: Dict[str, Any]):
    try:
        subject = data.get('subject', '')
        period = data.get('period', 90)
        # Показатели передаём в парсер, чтобы новости соответствовали теме
        # данных. Фильтр по теме мягкий (по корням слов + доменное
        # расширение), поэтому не «съедает» все результаты, как раньше.
        indicators = data.get('indicators') or get_indicators_from_java()
        news = await get_news_summary_raw(subject, period, indicators)
        return {"news": news[:10] if news else []}
    except Exception as e:
        return {"news": [
            {"title": "Ошибка", "summary": str(e), "source": "Система", "date": "", "url": "", "impact": "neutral"}]}


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=5000, reload=True)

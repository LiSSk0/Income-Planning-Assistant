from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Any, List
from ai_prediction import compare_models
from text_generation import gigachat_score_news, rank_news_by_heuristics
from news_parser import get_news_summary_raw
import json
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

_generate_news_cache: Dict[str, tuple[float, Any]] = {}
_CACHE_TTL_SEC = 120


class MultiPredictionRequest(BaseModel):
    data: dict[str, dict[str, dict[str, float]]]
    n_periods: int = 12


@app.post("/predict")
def predict(payload: MultiPredictionRequest):
    try:
        result = {}
        for metric_name, metric_data in payload.data.items():
            df = compare_models(metric_data, payload.n_periods)
            best_model = df.iloc[0]["model"]
            models_output = []
            for _, row in df.iterrows():
                forecast = row["forecast"]
                forecast_json = {
                    str(k.date()): float(v)
                    for k, v in forecast.items()
                }
                models_output.append({
                    "name": row["model"],
                    "metrics": {
                        "MAE": float(row["MAE"]) if row["MAE"] == row["MAE"] else None,
                        "RMSE": float(row["RMSE"]) if row["RMSE"] == row["RMSE"] else None,
                        "MAPE": float(row["MAPE"]) if row["MAPE"] == row["MAPE"] else None,
                        "time_sec": float(row["time_sec"])
                    },
                    "forecast": forecast_json,
                    "best": row["model"] == best_model
                })
            result[metric_name] = {
                "models": models_output,
                "best_model": best_model
            }
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.websocket("/ws/news")
async def websocket_news(websocket: WebSocket):
    await websocket.accept()
    logger.info("WebSocket /ws/news connected")
    try:
        data = await websocket.receive_text()
        params = json.loads(data)
        subject = params.get('subject', '')
        count = params.get('count', 5)

        await websocket.send_text(json.dumps({
            "phase": "START",
            "message": "Начинаем сбор новостей..."
        }))

        indicators = get_indicators_from_java()
        await websocket.send_text(json.dumps({
            "phase": "INDICATORS",
            "message": f"Получено {len(indicators)} показателей"
        }))

        all_news = await get_news_summary_raw(status_callback=websocket.send_text)

        if not all_news:
            await websocket.send_text(json.dumps({
                "phase": "DONE",
                "message": "Новостей не найдено",
                "data": []
            }))
            await websocket.close()
            return

        await websocket.send_text(json.dumps({
            "phase": "FOUND",
            "message": f"Найдено {len(all_news)} новостей"
        }))

        await websocket.send_text(json.dumps({
            "phase": "ANALYZING",
            "message": "Анализируем новости с помощью AI..."
        }))

        # Пробуем GigaChat
        analyzed = gigachat_score_news(all_news, subject, indicators, count)

        if analyzed and len(analyzed) > 0:
            # Дополняем URL
            for item in analyzed:
                if not item.get('url'):
                    for orig in all_news:
                        if orig['title'] == item['title']:
                            item['url'] = orig.get('url', '')
                            break
                if not item.get('date'):
                    item['date'] = ''
                if not item.get('source'):
                    item['source'] = 'Источник'
            result_news = analyzed
        else:
            logger.warning("GigaChat не вернул результат, используем эвристику")
            result_news = rank_news_by_heuristics(all_news, subject, indicators, limit=count)

        await websocket.send_text(json.dumps({
            "phase": "DONE",
            "message": f"Выбрано {len(result_news)} новостей",
            "data": result_news
        }))

    except WebSocketDisconnect:
        logger.info("WebSocket /ws/news disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        await websocket.send_text(json.dumps({
            "phase": "ERROR",
            "message": str(e)
        }))


def get_indicators_from_java() -> List[str]:
    try:
        response = requests.get("http://localhost:8080/api/indicators", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        logger.error(f"Ошибка получения показателей из Java: {e}")
    return []


@app.post("/generate-news")
async def generate_news(data: Dict[str, Any]):
    try:
        subject = data.get('subject', '')
        count = data.get('count', 5)
        indicators = data.get('indicators') or get_indicators_from_java()

        cache_key = f"news_{subject}"
        if cache_key in _generate_news_cache:
            cached_time, cached_data = _generate_news_cache[cache_key]
            if time.time() - cached_time < _CACHE_TTL_SEC:
                return cached_data

        news = await get_news_summary_raw()
        analyzed = gigachat_score_news(news, subject, indicators, count)
        if analyzed:
            result = {"news": analyzed}
        else:
            result = {"news": rank_news_by_heuristics(news, subject, indicators, limit=count)}

        _generate_news_cache[cache_key] = (time.time(), result)
        return result
    except Exception as e:
        logger.error(f"generate-news error: {e}")
        return {"news": []}


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="127.0.0.1", port=5000, reload=True)
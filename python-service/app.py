from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, Any
from ai_prediction import compare_models
from text_generation import gigachat_text, gigachat_analyze_news
from news_parser import get_news_summary_raw
import json
import requests

app = FastAPI(title="University Analytics AI Service")


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
                # Series -> JSON
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
    try:
        data = await websocket.receive_text()
        params = json.loads(data)
        subject = params.get('subject', '')
        period = params.get('period', 90)

        await websocket.send_text(json.dumps({"phase": "START", "message": "Начинаем сбор новостей..."}))

        indicators = get_indicators_from_java()
        await websocket.send_text(json.dumps({"phase": "INDICATORS",
                                              "message": f"Получено {len(indicators)} показателей"}))

        all_news = await get_news_summary_raw(
            subject, period, indicators,
            status_callback=websocket.send_text
        )

        if not all_news:
            await websocket.send_text(json.dumps({"phase": "DONE", "message": "Новостей не найдено", "data": []}))
            await websocket.close()
            return

        await websocket.send_text(json.dumps({"phase": "FOUND", "message": f"Найдено {len(all_news)} новостей"}))

        await websocket.send_text(
            json.dumps({"phase": "ANALYZING", "message": "Анализируем важность новостей через AI..."}))

        top_news = all_news[:20]
        news_text = "Вот список новостей:\n\n"
        for i, news in enumerate(top_news, 1):
            news_text += f"{i}. {news['title']} ({news['source']}, {news['date']})\n"
            news_text += f"   {news['summary'][:200]}...\n\n"

        analyzed = gigachat_analyze_news(news_text, subject, indicators)

        if analyzed:
            await websocket.send_text(json.dumps({"phase": "DONE",
                                                  "message": f"Выбрано {len(analyzed)} самых важных новостей",
                                                  "data": analyzed}))
        else:
            await websocket.send_text(json.dumps({"phase": "DONE",
                                                  "message": f"GigaChat недоступен, возвращаем {len(top_news[:5])} свежих новостей",
                                                  "data": top_news[:5]}))

    except WebSocketDisconnect:
        print("WebSocket disconnected")
    except Exception as e:
        await websocket.send_text(json.dumps({"phase": "ERROR", "message": str(e)}))


def get_indicators_from_java():
    try:
        response = requests.get("http://localhost:8080/api/indicators", timeout=5)
        if response.status_code == 200:
            return response.json()
    except Exception as e:
        print(f"Ошибка получения показателей из Java: {e}")
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
def generate_news(data: Dict[str, Any]):
    try:
        subject = data.get('subject', '')
        period = data.get('period', 90)
        indicators = get_indicators_from_java()
        news = get_news_summary_raw(subject, period, indicators)
        return {"news": news[:5] if news else []}
    except Exception as e:
        return {"news": [
            {"title": "Ошибка", "summary": str(e), "source": "Система", "date": "", "url": "", "impact": "neutral"}]}


@app.get("/health")
def health():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="127.0.0.1", port=5000, reload=True)
from typing import List
from gigachat import GigaChat
from gigachat.models import Chat, Messages
from dotenv import load_dotenv
import os
import asyncio
import json

load_dotenv()

AUTH_TOKEN = os.getenv("AUTH_TOKEN")


def gigachat_text(data: str) -> str:
    if not AUTH_TOKEN:
        return "Ошибка: токен GigaChat не найден"

    prompt = "Ты - ведущий FinTech-аналитик. Твоя задача - провести экспресс-анализ " \
             "предоставленных данных. Пиши максимально кратко, тезисно и строго по делу. " \
             "Только сухие факты и цифры. Максимум 3-4 предложения. " \
             "Вот данные: "

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        with GigaChat(credentials=AUTH_TOKEN, verify_ssl_certs=False) as giga:
            payload = Chat(
                model="GigaChat-Pro",
                messages=[Messages(role="user", content=prompt + data)],
                temperature=0.4,
                max_tokens=1000
            )
            response = giga.chat(payload)
            return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Ошибка GigaChat: {str(e)}"


def gigachat_analyze_news(news_text: str, subject: str, indicators: List[str] = None) -> list:
    if not AUTH_TOKEN:
        return [{
            "title": "Нет токена GigaChat",
            "summary": "Проверьте файл .env",
            "source": "Система",
            "date": "",
            "url": "",
            "impact": "neutral"
        }]

    keywords = ""
    if indicators:
        keywords = f"\n\nКлючевые слова для анализа (показатели из вашей системы): {', '.join(indicators)}"

    prompt = f"""Ты - аналитик, который отбирает самые важные новости для бизнеса.

Правила:
1. Проанализируй список новостей ниже.
2. Выбери от 3 до 5 самых важных новостей.
3. Обрати внимание на новости, связанные с регионом "{subject}" (если указан).
4. Обрати внимание на новости, связанные с этими показателями:{keywords}
5. Для каждой новости напиши краткое резюме (2-4 предложения) и укажи ссылку.
6. Оцени влияние: "positive" (позитивное), "negative" (негативное), "neutral" (нейтральное).
7. Верни ТОЛЬКО JSON-массив.

Формат ответа:
[
  {{
    "title": "Заголовок новости",
    "summary": "Краткое резюме",
    "source": "Источник",
    "date": "YYYY-MM-DD",
    "url": "ссылка",
    "impact": "positive|negative|neutral"
  }}
]

Вот новости:
{news_text}

Верни только JSON-массив, без лишнего текста."""

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        with GigaChat(credentials=AUTH_TOKEN, verify_ssl_certs=False) as giga:
            payload = Chat(
                model="GigaChat-Pro",
                messages=[Messages(role="user", content=prompt)],
                temperature=0.3,
                max_tokens=2000
            )
            response = giga.chat(payload)

            text = response.choices[0].message.content.strip()

            # Убираем обёртку Markdown
            if "```json" in text:
                text = text.split("```json")[1].split("```")[0]
            elif "```" in text:
                text = text.split("```")[1].split("```")[0]

            return json.loads(text)
    except Exception as e:
        print(f"Ошибка GigaChat: {e}")
        return None

def gigachat_anomalies(anomalies):
    return "Аномалии не обнаружены"
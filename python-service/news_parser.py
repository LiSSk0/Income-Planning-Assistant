import feedparser
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import re
from dateutil import parser
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Пул потоков для блокирующих операций (feedparser.parse — синхронный)
_executor = ThreadPoolExecutor(max_workers=4)


class NewsParser:
    def __init__(self):
        self.sources = [
            {"name": "РБК", "url": "https://rssexport.rbc.ru/rbcnews/news/20/full.rss"},
            {"name": "Ведомости", "url": "https://www.vedomosti.ru/rss/news"},
            {"name": "Коммерсантъ", "url": "https://www.kommersant.ru/RSS/news.xml"},
            {"name": "Интерфакс", "url": "https://www.interfax.ru/rss.asp"},
            {"name": "ТАСС", "url": "https://tass.ru/rss/v2.xml"},
        ]

    async def fetch_news(self, subject: str = "", period_days: int = 90,
                         indicators: List[str] = None, status_callback=None) -> List[Dict]:
        all_news = []
        since_date = datetime.now() - timedelta(days=period_days)

        tasks = []
        for source in self.sources:
            tasks.append(self._parse_source(source, subject, since_date, indicators))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, source_news in enumerate(results):
            # Пропускаем исключения — другие источники могут сработать
            if isinstance(source_news, Exception):
                print(f"Ошибка парсинга {self.sources[i]['name']}: {source_news}")
                continue

            all_news.extend(source_news)
            if status_callback and source_news:
                try:
                    import json
                    await status_callback(json.dumps({
                        "phase": "PARSED",
                        "source": source_news[0].get("source", "unknown") if source_news else "unknown",
                        "count": len(source_news),
                        "message": f"{source_news[0].get('source', 'unknown') if source_news else 'unknown'}: найдено {len(source_news)} новостей"
                    }))
                except Exception:
                    pass

        all_news.sort(key=lambda x: x["date"], reverse=True)
        return all_news

    async def _parse_source(self, source, subject, since_date, indicators):
        """Парсит RSS-источник. feedparser.parse() — блокирующий,
        поэтому выполняем его в отдельном потоке."""
        news = []
        try:
            loop = asyncio.get_event_loop()
            feed = await loop.run_in_executor(_executor, feedparser.parse, source["url"])

            for entry in feed.entries:
                pub_date = self._parse_date(entry.get("published", ""))
                if not pub_date or pub_date < since_date:
                    continue

                title = entry.get("title", "")
                summary = entry.get("summary", "")
                text = (title + " " + summary).lower()

                # Фильтр по субъекту (если указан)
                if subject and subject.lower() not in text:
                    # Мягкий фильтр: проверяем отдельные слова субъекта
                    subject_words = [w for w in subject.lower().split() if len(w) > 3]
                    if subject_words and not any(w in text for w in subject_words):
                        continue

                # Фильтр по показателям — МЯГКИЙ (необязательный).
                # Если ни один показатель не встречается, новость всё равно
                # может быть полезной (GigaChat оценит позже).
                # Не отфильтровываем — просто помечаем.

                news.append({
                    "title": title,
                    "summary": self._clean_text(summary),
                    "source": source["name"],
                    "date": pub_date.strftime("%Y-%m-%d"),
                    "url": entry.get("link", ""),
                })
        except Exception as e:
            print(f"Ошибка парсинга {source['name']}: {e}")
        return news

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        if not date_str:
            return None
        try:
            dt = parser.parse(date_str)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except:
            return None

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()


async def get_news_summary_raw(subject: str = "", period_days: int = 90,
                               indicators: List[str] = None, status_callback=None) -> List[Dict]:
    news_parser = NewsParser()
    return await news_parser.fetch_news(subject, period_days, indicators, status_callback)
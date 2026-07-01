import feedparser
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import re
from dateutil import parser
import asyncio


class NewsParser:
    def __init__(self):
        self.sources = [
            {"name": "РБК", "url": "https://www.rbc.ru/rss/"},
            {"name": "Ведомости", "url": "https://www.vedomosti.ru/rss/"},
            {"name": "Коммерсантъ", "url": "https://www.kommersant.ru/rss/news.xml"},
            {"name": "Интерфакс", "url": "https://www.interfax.ru/rss.asp"}
        ]

    async def fetch_news(self, subject: str = "", period_days: int = 90,
                         indicators: List[str] = None, status_callback=None) -> List[Dict]:
        all_news = []
        since_date = datetime.now() - timedelta(days=period_days)

        tasks = []
        for source in self.sources:
            tasks.append(self._parse_source(source, subject, since_date, indicators))

        results = await asyncio.gather(*tasks)

        for source_news in results:
            all_news.extend(source_news)
            if status_callback and source_news:
                await status_callback({
                    "phase": "PARSED",
                    "source": source_news[0].get("source", "unknown") if source_news else "unknown",
                    "count": len(source_news),
                    "message": f"{source_news[0].get('source', 'unknown') if source_news else 'unknown'}: найдено {len(source_news)} новостей"
                })

        all_news.sort(key=lambda x: x["date"], reverse=True)
        return all_news

    async def _parse_source(self, source, subject, since_date, indicators):
        news = []
        try:
            feed = feedparser.parse(source["url"])
            for entry in feed.entries:
                pub_date = self._parse_date(entry.get("published", ""))
                if not pub_date or pub_date < since_date:
                    continue

                title = entry.get("title", "")
                summary = entry.get("summary", "")
                text = (title + " " + summary).lower()

                if subject and subject.lower() not in text:
                    continue

                if indicators:
                    has_match = any(ind.lower() in text for ind in indicators)
                    if not has_match:
                        continue

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
    parser = NewsParser()
    return await parser.fetch_news(subject, period_days, indicators, status_callback)
import feedparser
from datetime import datetime, timezone
from typing import List, Dict, Optional
import re
from dateutil import parser
import asyncio
from concurrent.futures import ThreadPoolExecutor
import requests
import time
import os
import json

os.environ['HTTP_PROXY'] = ''
os.environ['HTTPS_PROXY'] = ''
os.environ['NO_PROXY'] = '*'

_executor = ThreadPoolExecutor(max_workers=4)

_news_cache: Dict[str, tuple[float, List[Dict]]] = {}
_CACHE_TTL_SEC = 120

class NewsParser:
    def __init__(self):
        self.sources = [
            {"name": "Ведомости", "url": "https://www.vedomosti.ru/rss/news"},
            {"name": "Коммерсантъ", "url": "https://www.kommersant.ru/RSS/news.xml"},
        ]

    async def fetch_news(self, status_callback=None) -> List[Dict]:
        cache_key = "rss_all"
        if cache_key in _news_cache:
            cached_time, cached_data = _news_cache[cache_key]
            if time.time() - cached_time < _CACHE_TTL_SEC:
                return cached_data

        all_news = []
        print(f"[DEBUG] Парсинг RSS-лент...")

        tasks = []
        for source in self.sources:
            tasks.append(self._parse_source(source))

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for i, source_news in enumerate(results):
            if isinstance(source_news, Exception):
                print(f"Ошибка {self.sources[i]['name']}: {source_news}")
                continue
            all_news.extend(source_news)
            if status_callback and source_news:
                try:
                    await status_callback(json.dumps({
                        "phase": "PARSED",
                        "source": source_news[0].get("source", "unknown") if source_news else "unknown",
                        "count": len(source_news),
                        "message": f"{source_news[0].get('source', 'unknown') if source_news else 'unknown'}: {len(source_news)} новостей"
                    }))
                except Exception:
                    pass

        all_news.sort(key=lambda x: x["date"], reverse=True)
        print(f"[DEBUG] Всего новостей: {len(all_news)}")
        if all_news:
            print(f"[DEBUG] Диапазон дат: {all_news[-1]['date']} – {all_news[0]['date']}")
        _news_cache[cache_key] = (time.time(), all_news)
        return all_news

    async def _parse_source(self, source):
        news = []
        try:
            loop = asyncio.get_event_loop()
            resp = await loop.run_in_executor(_executor, self._fetch_rss, source["url"])
            if resp is None:
                return news

            feed = feedparser.parse(resp)
            for entry in feed.entries:
                pub_date = self._parse_date(entry.get("published", ""))
                if not pub_date:
                    continue

                title = entry.get("title", "")
                summary = entry.get("summary", "")

                news.append({
                    "title": title,
                    "summary": self._clean_text(summary),
                    "source": source["name"],
                    "date": pub_date.strftime("%Y-%m-%d"),
                    "url": entry.get("link", ""),
                })
        except Exception as e:
            print(f"Ошибка {source['name']}: {e}")
        return news

    def _fetch_rss(self, url: str) -> Optional[str]:
        try:
            response = requests.get(
                url,
                timeout=15,
                proxies={'http': None, 'https': None},
                verify=False,
                headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}
            )
            response.raise_for_status()
            return response.text
        except Exception as e:
            print(f"Ошибка RSS {url}: {e}")
            return None

    def _parse_date(self, date_str: str) -> Optional[datetime]:
        if not date_str:
            return None
        try:
            dt = parser.parse(date_str)
            if dt.tzinfo is not None:
                dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
            return dt
        except:
            try:
                match = re.search(r'(\d{1,2})\s+(\w+)\s+(\d{4})', date_str)
                if match:
                    day, month_str, year = match.groups()
                    month_map = {
                        'jan': 1, 'feb': 2, 'mar': 3, 'apr': 4, 'may': 5, 'jun': 6,
                        'jul': 7, 'aug': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dec': 12
                    }
                    month = month_map.get(month_str.lower(), 1)
                    return datetime(int(year), month, int(day))
            except:
                pass
            return None

    def _clean_text(self, text: str) -> str:
        if not text:
            return ""
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()


async def get_news_summary_raw(status_callback=None) -> List[Dict]:
    news_parser = NewsParser()
    return await news_parser.fetch_news(status_callback)
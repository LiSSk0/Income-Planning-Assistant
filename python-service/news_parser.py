import feedparser
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Set
import re
from dateutil import parser
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Пул потоков для блокирующих операций (feedparser.parse — синхронный)
_executor = ThreadPoolExecutor(max_workers=4)

# ---------------------------------------------------------------------------
# Тематическая релевантность.
# Новости фильтруются не «как попало», а по теме загруженных данных: из
# названий показателей ("Поголовье скота", "Надой молока", ...) строятся
# ключевые префиксы, а близкие по смыслу термины добавляются через
# доменные кластеры. Тогда данные про животноводство находят новости про
# животноводство ("болезнь подкосила скот в регионе"), а не случайные.
# ---------------------------------------------------------------------------

# Служебные/родовые слова из названий показателей — не несут темы.
# Сюда же — универсальные финансовые слова ("доход", "выручка", "прибыль"…):
# они есть почти в каждом наборе данных этого приложения, поэтому сами по
# себе не должны тянуть за собой всю деловую/экономическую ленту. Тему
# задают предметные слова ("поголовье", "скот", "столовая").
_STOPWORDS = {
    "количество", "доля", "средний", "среднее", "средняя", "общий", "общее",
    "общая", "значение", "показатель", "всего", "прочие", "прочее", "иные",
    "процент", "единиц", "штук", "мера", "измерения", "чистая", "чистый",
    "уровень", "объем", "объём", "число", "индекс", "коэффициент", "темп",
    "доход", "доходы", "доходность", "выручка", "прибыль", "рентабельность",
    "реализация", "реализации", "продукция", "продукции", "продуктивных",
    "продуктивные", "расход", "расходы", "стоимость", "цена", "сумма",
    "голову", "голова", "голов",
}


# Нормализация «ё» → «е», чтобы «падёж/падеж» и т.п. совпадали.
def _norm(s: str) -> str:
    return s.lower().replace("ё", "е")


# Доменные кластеры. Триггеры ищутся ПОДСТРОКОЙ в названиях показателей
# (устойчиво к падежам: «скот» найдётся в «поголовье скота»). Если кластер
# сработал — его термины-префиксы подмешиваются к теме, чтобы ловить
# косвенно связанные новости (болезни скота, падёж, птичий грипп…).
_DOMAIN_CLUSTERS = [
    {  # сельское хозяйство / животноводство
        "triggers": ["скот", "коров", "поголов", "надой", "молок", "птиц",
                     "свин", "овц", "хозяйств", "ферм", "животновод", "корм",
                     "урожай", "зерн", "агро", "теленок", "бык"],
        "expand": ["скот", "коров", "молок", "надой", "птиц", "свин", "овц",
                   "ферм", "животновод", "сельск", "агропром", "аграр",
                   "урожай", "корма", "падеж", "ветеринар", "мясо", "зерн",
                   "посев", "фермер", "птицефабрик", "засух", "эпизоот",
                   "грипп", "вспышк", "поголов", "удой", "убой", "сельхоз",
                   "продовольств", "минсельхоз"],
    },
    {  # общепит / студенческое питание
        "triggers": ["студент", "вуз", "университет", "обучен", "столов",
                     "питани", "общепит", "банан", "блюд", "кухн", "меню"],
        "expand": ["студент", "вуз", "университет", "образован", "общепит",
                   "столов", "питани", "ресторан", "кафе", "продукт",
                   "поставщик", "продовольств", "фрукт", "овощ"],
    },
    {  # банк / финтех (узкие триггеры — только явно банковская тема)
        "triggers": ["банк", "транзакц", "arpu", "эквайринг", "депозит",
                     "кредит", "вклад"],
        "expand": ["банк", "финанс", "кредит", "вклад", "депозит", "ставк",
                   "эквайринг", "платеж", "карт", "инфляц"],
    },
]


def build_topic_prefixes(indicators: Optional[List[str]]) -> Set[str]:
    """Строит набор ключевых префиксов из названий показателей + доменное
    расширение. Пустой набор ⇒ тема неизвестна ⇒ фильтр не применяется."""
    if not indicators:
        return set()

    # Предметные слова из названий показателей (без служебных/финансовых).
    words: List[str] = []
    for ind in indicators:
        for w in re.split(r"[\s,/()«»\"'.\-]+", _norm(ind)):
            wl = w.strip()
            if len(wl) > 4 and wl not in _STOPWORDS:
                words.append(wl)

    # Префикс = первые 6 букв слова (устойчиво к окончаниям, но достаточно
    # специфично, чтобы «поголов» не совпадал с «погода»).
    prefixes = {w[:6] for w in words}

    # Доменное расширение по подстрочному совпадению триггеров.
    blob = _norm(" ".join(indicators))
    for cluster in _DOMAIN_CLUSTERS:
        if any(t in blob for t in cluster["triggers"]):
            prefixes |= {_norm(e) for e in cluster["expand"]}

    return {p for p in prefixes if len(p) >= 4}


def _text_matches_topic(text: str, prefixes: Set[str]) -> bool:
    """Есть ли в тексте новости хотя бы одно тематическое слово."""
    if not prefixes:
        return True  # тема неизвестна — не отсекаем
    for w in re.findall(r"[а-яёa-z]+", _norm(text)):
        for p in prefixes:
            if w.startswith(p):
                return True
    return False


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

        # Ключевые префиксы темы данных — общие для всех источников.
        topic_prefixes = build_topic_prefixes(indicators)

        tasks = []
        for source in self.sources:
            tasks.append(self._parse_source(source, subject, since_date, topic_prefixes))

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

    async def _parse_source(self, source, subject, since_date, topic_prefixes):
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

                # Фильтр по региону (если выбран). Проверяем как целую фразу,
                # так и значимые слова региона (напр. «Приволжский» из
                # «Приволжский ФО»).
                if subject and subject.lower() not in text:
                    subject_words = [w for w in subject.lower().split() if len(w) > 3]
                    if subject_words and not any(w in text for w in subject_words):
                        continue

                # Тематический фильтр: новость должна относиться к теме
                # загруженных данных. Именно это отсекает «случайные» новости.
                if not _text_matches_topic(text, topic_prefixes):
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
    news_parser = NewsParser()
    return await news_parser.fetch_news(subject, period_days, indicators, status_callback)
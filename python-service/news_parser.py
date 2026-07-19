import feedparser
import requests
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional, Set
import re
from dateutil import parser
import asyncio
from concurrent.futures import ThreadPoolExecutor

# Пул потоков для блокирующих операций (feedparser.parse — синхронный)
_executor = ThreadPoolExecutor(max_workers=4)

# feedparser.parse(url) сам ходит в сеть БЕЗ таймаута — одна зависшая RSS-лента
# блокирует всю выдачу, и Java-бэкенд рвёт запрос по read-timeout (60с,
# «Read timed out»). Поэтому качаем ленту через requests с жёстким таймаутом,
# а feedparser'у отдаём уже готовые байты.
_FEED_TIMEOUT = 8  # секунд на один источник
_FEED_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)"}


def _fetch_feed(url: str):
    resp = requests.get(url, timeout=_FEED_TIMEOUT, headers=_FEED_HEADERS)
    resp.raise_for_status()
    return feedparser.parse(resp.content)

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
    # Обобщённые бизнес-/производственные слова: встречаются в названиях
    # показателей почти любой отрасли и в куче несвязанных новостей
    # ("продажи сидра", "производство ракет", "новых ударов"). Тему они не
    # задают — иначе фильтр пропускает мусор. Специфику даёт доменный кластер.
    "продаж", "продажи", "продажа", "продаж", "производство", "производства",
    "производственный", "новый", "новая", "новое", "новые", "новых",
    "зарегистрированный", "зарегистрированных", "зарегистрирован",
    "отечественный", "отечественная", "отечественное", "отечественные",
    "отечественных", "парк", "марка", "марки", "марок", "объем",
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
    {  # автомобильный рынок / автопром
        "triggers": ["автомобил", "автопром", "автоваз", "дилер", "иномар",
                     "легков"],
        "expand": ["автомобил", "автомобильн", "автопром", "автоваз",
                   "автосалон", "автопарк", "автодилер", "автозавод",
                   "автокредит", "авторынок", "автокомпонент", "машин",
                   "иномарк", "легков", "лада", "камаз", "дилер", "птс",
                   "утильсбор"],
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


# Родовые слова в названиях регионов/округов. Сами по себе они НЕ отличают
# регион: «округ», «область», «федеральный» есть у десятков субъектов и
# встречаются в множестве несвязанных новостей. Раньше матч по ним превращал
# фильтр в «пропускать всё» (напр. «Приволжский федеральный округ» совпадал
# с любой новостью, где есть слово «федеральный» или «округ»).
_REGION_STOPWORDS = {
    "федеральный", "федеральная", "федеральное", "федерального", "федеральной",
    "округ", "округа", "округе", "область", "области", "областная",
    "край", "края", "крае", "республика", "республики", "республике",
    "автономный", "автономная", "автономного", "автономной", "автономная",
    "город", "города", "region", "district",
}


# Синонимы регионов, у которых форма в новостях расходится с официальным
# названием. Префиксный матч по первым 6 буквам их не ловит: у «Московская»
# корень «москов», а новости пишут «Москва»/«в Москве» (→ «москв») или
# «Подмосковье». То же с Петербургом (город ≠ «Ленинградская»). У остальных
# регионов город и прилагательное совпадают по префиксу («Новосибирская»↔
# «Новосибирск» → «новоси»), поэтому им синонимы не нужны.
# Ключ ищется подстрокой в нормализованном названии субъекта; значения —
# дополнительные корни (проверяются тем же startswith).
_REGION_ALIASES = {
    "московск": ["москв", "подмосков", "мособл"],
    "москва": ["москв", "подмосков", "мособл", "московск"],
    "петербург": ["петербург", "питер"],
    "ленинградск": ["петербург", "питер", "ленинград"],
}


def _region_stems(subject: str) -> List[str]:
    """Отличительные корни из названия региона (без родовых слов).
    Корень = первые 6 букв — устойчиво к падежам («Приволжский»/«Приволжье»
    → «приволж»). Плюс синонимы из _REGION_ALIASES для регионов, чья форма
    в новостях отличается от официального названия (Москва, Петербург)."""
    norm = _norm(subject)
    stems = []
    for w in re.split(r"[\s,/()«»\"'.\-]+", norm):
        wl = w.strip()
        if len(wl) > 3 and wl not in _REGION_STOPWORDS:
            stems.append(wl[:6])
    for key, aliases in _REGION_ALIASES.items():
        if key in norm:
            stems.extend(aliases)
    return stems


def _region_matches(text: str, subject: str) -> bool:
    """Относится ли новость к выбранному региону.

    Пустой регион ⇒ фильтр не применяется. Иначе — либо полное вхождение
    названия, либо совпадение хотя бы одного отличительного корня. Если в
    названии только родовые слова, фильтровать нечем — пропускаем."""
    if not subject:
        return True
    norm_text = _norm(text)
    if _norm(subject) in norm_text:
        return True
    stems = _region_stems(subject)
    if not stems:
        return True
    for w in re.findall(r"[а-яёa-z]+", norm_text):
        for st in stems:
            if w.startswith(st):
                return True
    return False


class NewsParser:
    def __init__(self):
        self.sources = [
            {"name": "РБК", "url": "https://rssexport.rbc.ru/rbcnews/news/30/full.rss"},
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
            feed = await loop.run_in_executor(_executor, _fetch_feed, source["url"])

            for entry in feed.entries:
                pub_date = self._parse_date(entry.get("published", ""))
                if not pub_date or pub_date < since_date:
                    continue

                title = entry.get("title", "")
                summary = entry.get("summary", "")
                text = (title + " " + summary).lower()

                # Фильтр по региону (если выбран). Матч по отличительным корням
                # названия — родовые слова («округ», «федеральный») игнорируются,
                # иначе фильтр пропускал бы почти любые новости.
                if not _region_matches(text, subject):
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
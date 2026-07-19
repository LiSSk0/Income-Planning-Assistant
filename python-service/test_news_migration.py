"""Тест перенесённого функционала новостей (парсинг RSS + анализ через GigaChat).

Повторяет путь обработчика /ws/news из app.py:
  get_news_summary_raw(subject, period, indicators)  ->  gigachat_analyze_news(...)
Весь вывод (логи парсера и GigaChat) печатается в stdout; запускать с
`python test_news_migration.py 2>&1 | tee gigachat.log`, чтобы сохранить лог.
"""
import asyncio
import json
import logging
import sys

# На Windows stdout по умолчанию cp1251 — при выводе в файл кириллица бьётся.
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger("news_test")

from news_parser import get_news_summary_raw
from text_generation import gigachat_analyze_news, AUTH_TOKEN
from app import _restore_source_links  # тот же шаг восстановления ссылок, что в /ws/news

# Данные приложения — автопром (датасет auto_industry_income_tree.xlsx,
# кластер «автомобильный рынок / автопром»).
SUBJECT = ""  # регион не фиксируем, чтобы проверить тематический фильтр
PERIOD = 90
INDICATORS = [
    "Выручка от продаж автомобилей",
    "Объём продаж новых автомобилей",
    "Объём производства автомобилей",
    "Продажи автомобилей отечественных марок",
    "Средняя цена автомобиля",
    "Чистая прибыль дилера",
    "Зарегистрированный парк автомобилей",
    "Доля отечественных марок",
]


async def status_cb(text: str):
    log.info("STATUS %s", text)


def main():
    log.info("=== ТЕСТ ПЕРЕНОСА НОВОСТНОГО ФУНКЦИОНАЛА ===")
    log.info("AUTH_TOKEN присутствует: %s", bool(AUTH_TOKEN))
    log.info("subject=%r period=%s indicators=%s", SUBJECT, PERIOD, INDICATORS)

    # 1. Парсинг RSS + тематическая фильтрация (перенесённый news_parser.py)
    log.info("--- Шаг 1: сбор и фильтрация новостей ---")
    all_news = asyncio.run(
        get_news_summary_raw(SUBJECT, PERIOD, INDICATORS, status_callback=status_cb)
    )
    log.info("Найдено новостей после фильтра: %d", len(all_news))
    for i, n in enumerate(all_news[:20], 1):
        log.info("  %2d. [%s] %s", i, n["source"], n["title"])

    if not all_news:
        log.warning("Новостей не найдено — GigaChat вызывать нечем.")
        return

    # 2. Анализ важности через GigaChat (перенесённый text_generation.py)
    log.info("--- Шаг 2: анализ новостей через GigaChat ---")
    top_news = all_news[:20]
    news_text = "Вот список новостей:\n\n"
    for i, news in enumerate(top_news, 1):
        news_text += f"{i}. {news['title']} ({news['source']}, {news['date']})\n"
        news_text += f"   {news['summary'][:200]}...\n\n"

    analyzed = gigachat_analyze_news(news_text, SUBJECT, INDICATORS)

    log.info("--- Результат GigaChat ---")
    if analyzed:
        _restore_source_links(analyzed, all_news)  # подставляем настоящие url/source из RSS
        log.info("GigaChat выбрал %d новостей (ссылки восстановлены из RSS):", len(analyzed))
        print(json.dumps(analyzed, ensure_ascii=False, indent=2))
    else:
        log.warning("GigaChat не вернул результат (None) — сработал бы фолбэк на свежие новости.")

    log.info("=== ТЕСТ ЗАВЕРШЁН ===")


if __name__ == "__main__":
    main()

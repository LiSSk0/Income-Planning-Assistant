import numpy as np
from scipy.stats import norm
from coef_seasonality import calculate_seasonality


def calculate_forecast_interval(historical_data, predicted_value, seasonality_indices, confidence_level=0.95):
    """
    Возвращает:
        intervals: dict {месяц: (нижняя, верхняя)}
        total_interval: (нижняя_суммы, верхняя_суммы)
        sigma: общее СКО (очищенное)
    """
    # Сбор остатков (десезонированные, с удалением тренда по годам)
    residuals = []
    for year, months_data in historical_data.items():
        deseasonalized = []
        for month, value in months_data.items():
            coeff = seasonality_indices.get(month)
            if coeff is None or coeff == 0:
                raise ValueError(f"Нет индекса сезонности для месяца {month}")
            deseasonalized.append(value / coeff)
        year_mean = np.mean(deseasonalized)
        residuals.extend([v - year_mean for v in deseasonalized])

    sigma = np.std(residuals, ddof=1)
    z = norm.ppf((1 + confidence_level) / 2)

    # Интервалы по месяцам
    intervals = {}
    for month, mu in predicted_value.items():
        lower = mu - z * sigma
        upper = mu + z * sigma
        intervals[month] = (lower, upper)

    # Суммарный интервал для всех месяцев в predicted_value
    mu_total = sum(predicted_value.values())
    n_months = len(predicted_value)
    sigma_total = sigma * np.sqrt(n_months)
    lower_total = mu_total - z * sigma_total
    upper_total = mu_total + z * sigma_total
    total_interval = (lower_total, upper_total)

    return intervals, total_interval, sigma


# ------------------- Пример -------------------
historical_data = {
    2024: {1: 55000, 2: 60000, 3: 62000, 4: 65000, 5: 68000, 6: 70000,
           7: 45000, 8: 50000, 9: 72000, 10: 71000, 11: 69000, 12: 66000},
    2025: {1: 58000, 2: 63000, 3: 65000, 4: 68000, 5: 71000, 6: 73000,
           7: 48000, 8: 52000, 9: 75000, 10: 74000, 11: 72000, 12: 69000}
}

seasonality = calculate_seasonality(historical_data)
predicted = {3: 70000, 4: 73000}

intervals, total_interval, sigma = calculate_forecast_interval(
    historical_data, predicted, seasonality, 0.95
)

# Вывод
for month, (lo, hi) in intervals.items():
    print(f"Месяц {month}: {lo:.0f} – {hi:.0f}")

mu_total = sum(predicted.values())
lo_total, hi_total = total_interval
print(f"\nСумма за {len(predicted)} месяца (март+апрель):")
print(f"Прогноз = {mu_total:.0f}, интервал: {lo_total:.0f} – {hi_total:.0f}")
print(f"(σ суммы = {sigma * np.sqrt(len(predicted)):.2f})")
import numpy as np
from scipy.stats import norm
from coef_seasonality import calculate_seasonality


def calculate_forecast_interval(historical_data, predicted_value, seasonality_indices, confidence_level=0.95):
    """
    Рассчитывает верхнюю и нижнюю границы доверительного интервала для прогноза.

    Параметры:
    ----------
    historical_data : dict
        {год: {месяц: значение}} где год - int, месяц - int (1..12), значение - float.
    predicted_value : dict
        {месяц: прогнозное_значение} для целевого периода (например, {3: 40000, 4: 45000}).
    seasonality_indices : dict
        {месяц: коэффициент_сезонности} для всех 12 месяцев (уже рассчитанные вашей функцией).
    confidence_level : float, default=0.95
        Уровень доверия (0.95 для 95%).

    Возвращает:
    -----------
    tuple (intervals, sigma)
        intervals: dict {месяц: (нижняя_граница, верхняя_граница)}
        sigma: float (СКО, очищенное от сезонности и тренда)
    """
    # Собираем остатки (десезонированные значения с удалённым трендом по годам)
    residuals = []

    for year, months_data in historical_data.items():
        # Очищаем от сезонности для этого года
        deseasonalized_year = []
        for month, value in months_data.items():
            coeff = seasonality_indices.get(month)
            if coeff is None or coeff == 0:
                raise ValueError(f"Нет индекса сезонности для месяца {month}")
            deseasonalized_year.append(value / coeff)

        # Среднее по году (убираем тренд)
        year_mean = np.mean(deseasonalized_year)
        # Отклонения от годового среднего
        residuals.extend([v - year_mean for v in deseasonalized_year])

    # СКО по всем остаткам (выборочное, n-1)
    sigma = np.std(residuals, ddof=1)

    # Z-коэффициент для заданного уровня доверия (двусторонний)
    z = norm.ppf((1 + confidence_level) / 2)

    # Строим интервалы для каждого прогнозируемого месяца
    intervals = {}
    for month, mu in predicted_value.items():
        lower = mu - z * sigma
        upper = mu + z * sigma
        intervals[month] = (lower, upper)

    return intervals


historical_data = {
    2024: {
        1: 55000, 2: 60000, 3: 62000, 4: 65000, 5: 68000, 6: 70000,
        7: 45000, 8: 50000, 9: 72000, 10: 71000, 11: 69000, 12: 66000
    },
    2025: {
        1: 58000, 2: 63000, 3: 65000, 4: 68000, 5: 71000, 6: 73000,
        7: 48000, 8: 52000, 9: 75000, 10: 74000, 11: 72000, 12: 69000
    }
}

seasonality = calculate_seasonality(historical_data)
print(seasonality)
print()

# Прогноз на март и апрель 2026 (числа придуманы)
predicted = {3: 70000, 4: 73000}

# Расчёт доверительного интервала
intervals = calculate_forecast_interval(
    historical_data=historical_data,
    predicted_value=predicted,
    seasonality_indices=seasonality,
    confidence_level=0.95
)

# Вывод
for month, (lower, upper) in intervals.items():
    print(f"Месяц {month}: {lower:.0f} – {upper:.0f}")



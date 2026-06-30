import pandas as pd
import numpy as np
from coef_seasonality import calculate_seasonality


def data_to_series(data: dict[int, dict[int, float]]) -> pd.Series:
    values = {}
    for year, months in data.items():
        for month, metric in months.items():
            values[pd.Timestamp(year, month, 1)] = metric
    series = pd.Series(values).sort_index()
    series = series.asfreq("MS", fill_value=0)  # ms - month start, пропущенные месяцы заполняем 0
    return series


def detect_anomalies(data: dict[int, dict[int, float]],
                     seasonality: dict[int, float],
                     window: int = 6,
                     context: int = 2) -> pd.DataFrame:
    series_raw = data_to_series(data)

    # получаем очищенный ряд (учёт сезонности)
    months = series_raw.index.month
    seasonal_factors = np.array([seasonality.get(m, 1.0) for m in months])  # 1.0 если вдруг месяца не оказалось
    seasonal_factors = np.where(seasonal_factors == 0, 1, seasonal_factors)  # если вдруг индекс 0.0

    series_clean = series_raw / seasonal_factors

    # считаем скользящее среднее (чистые данные тут уже)
    mean = series_clean.rolling(window).mean()
    std = series_clean.rolling(window).std()

    # z-score
    z = (series_clean - mean) / std

    # pct = series_clean.pct_change() * 100
    # mean_pct = pct.rolling(window).mean()
    # std_pct = pct.rolling(window).std()
    # z = (pct - mean_pct) / std_pct

    # процент изменения (MoM)
    pct_change_clean = (series_clean - series_clean.shift(1)) / series_clean.shift(1) * 100

    result = []
    for idx in range(len(series_raw)):
        date = series_raw.index[idx]
        raw_value = series_raw.iloc[idx]  # перевод обратно в рубли
        z_score = z.iloc[idx]
        pct = pct_change_clean.iloc[idx]

        if np.isnan(z_score) or abs(z_score) <= 1.8:
            is_anomaly = False
            atype = "normal"
        elif z_score > 2:
            is_anomaly = True
            atype = "spike"
        elif z_score < -2:
            is_anomaly = True
            atype = "drop"
        else:
            is_anomaly = True
            atype = "outlier"

        result.append({
            "date": date,
            "actual_rub": raw_value,
            "expected_clean": mean.iloc[idx],
            "pct_change": pct,
            "anomaly": is_anomaly,
            "type": atype
        })

    df = pd.DataFrame(result)

    # пересчитываем expected обратно в рубли
    df['expected_rub'] = df['expected_clean'] * seasonal_factors

    # 8. Финальный формат для бэка (сортируем по убыванию процента)
    df_final = df[df['anomaly']].sort_values(by='pct_change', ascending=True)

    return df_final[['date', 'actual_rub', 'expected_rub', 'type', 'pct_change']]


if __name__ == "__main__":
    input_data = {
        2021: {
            1: 95000, 2: 98000, 3: 101000, 4: 105000, 5: 108000, 6: 85000,
            7: 55000, 8: 60000, 9: 130000, 10: 120000, 11: 115000, 12: 110000
        },
        2022: {
            1: 105000, 2: 108000, 3: 111000, 4: 115000, 5: 118000, 6: 95000,
            7: 62000, 8: 68000, 9: 145000, 10: 135000, 11: 128000, 12: 122000
        },
        2023: {
            1: 115000, 2: 118000, 3: 121000, 4: 125000, 5: 128000, 6: 105000,
            7: 70000, 8: 75000, 9: 160000, 10: 148000, 11: 140000, 12: 135000
        },
        2024: {
            1: 125000, 2: 128000, 3: 131000, 4: 135000, 5: 128000, 6: 115000,
            7: 78000, 8: 82000, 9: 175000, 10: 162000, 11: 155000, 12: 148000
        },
        2025: {
            1: 135000, 2: 138000, 3: 141000, 4: 500000, 5: 148000, 6: 125000,  # аномалия в апреле (+250%)
            7: 85000, 8: 90000, 9: 190000, 10: 175000, 11: 168000, 12: 30000  # аномалия в декабре (провал на -80%)
        }
    }

    indexes_season = calculate_seasonality(input_data)
    print(indexes_season)

    print(detect_anomalies(input_data, indexes_season))

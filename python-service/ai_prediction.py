from statsmodels.tsa.holtwinters import ExponentialSmoothing
from statsmodels.tsa.statespace.sarimax import SARIMAX
from prophet import Prophet

import time
from statsmodels.tsa.seasonal import STL
from statsmodels.tsa.api import SimpleExpSmoothing
from sklearn.linear_model import Ridge
from sklearn.linear_model import LinearRegression

import logging
import warnings

from sklearn.metrics import mean_absolute_error, mean_squared_error, mean_absolute_percentage_error
import pandas as pd
import numpy as np

logging.getLogger("cmdstanpy").disabled = True
logging.getLogger("prophet").disabled = True

warnings.filterwarnings("ignore")


def data_transformation(data: dict[str, dict[str, float]]) -> pd.Series:
    values = {}

    for year, months in data.items():
        year = int(year)

        for month, metric in months.items():
            month = int(month)
            values[pd.Timestamp(year=year, month=month, day=1)] = metric

    series = pd.Series(values).sort_index()
    series = series.asfreq("MS")  # MS = Month Start

    return series


def exponential_smoothing(series: pd.Series, n:int) -> pd.DataFrame:
    model = ExponentialSmoothing(
        series,
        trend="add", # "add" - линейный рост, "mul" - процентный рост, None - тренда нет
        seasonal="add", # "add" - сезонность фиксирована, "mul" - растёт вместе с метрикой, None - сезонности нет
        seasonal_periods=12
    )
    fit = model.fit()
    prediction = fit.forecast(n)
    return prediction


def sarimax_prediction(series: pd.Series, n:int) -> pd.DataFrame:
    model = SARIMAX(
        series,
        order=(1,1,1), # (p, d, q)
        # p - сколько прошлых точек влияет на текущую
        # d - дифференцирование (0 - если тренда нет, ряд стабилен, 1 - убираем линейный рост, 2 - убирает квадратичный рост)
        # q - ошибка модели
        seasonal_order=(1,1,1,12) # (P, D, Q, s) то же самое но для сезонности
    )
    fit = model.fit(disp=False)
    prediction = fit.forecast(n)
    return prediction


def prophet_prediction(series: pd.Series, n: int) -> pd.DataFrame:
    df = pd.DataFrame({
        "ds": series.index,
        "y": series.values
    })
    model = Prophet(
        yearly_seasonality=True,
        weekly_seasonality=False,
        daily_seasonality=False
    )
    model.fit(df)
    future = model.make_future_dataframe(
        periods=n,
        freq="MS"
    )
    prediction = model.predict(future)
    return prediction


def stl_decomposition_prediction(series: pd.Series, n: int) -> pd.Series:
    res = STL(series, period=12, robust=True).fit() # robust=True защищает от аномалий

    trend = res.trend
    x = np.arange(len(trend)).reshape(-1, 1)
    y = trend.values

    trend_model = LinearRegression().fit(x, y)

    future_x = np.arange(len(trend), len(trend) + n).reshape(-1, 1)
    future_trend = trend_model.predict(future_x)

    last_year_seasonal = res.seasonal.iloc[-12:].values
    future_seasonal = np.array([last_year_seasonal[i % 12] for i in range(n)])

    prediction_values = future_trend + future_seasonal

    future_index = pd.date_range(start=series.index[-1] + pd.offsets.MonthBegin(1), periods=n, freq="MS")
    return pd.Series(prediction_values, index=future_index)


def ridge_regression_prediction(series: pd.Series, n: int) -> pd.Series:
    df = pd.DataFrame({'y': series})
    for i in range(1, 13):
        df[f'lag_{i}'] = df['y'].shift(i)

    df = df.dropna()

    X = df.drop(columns=['y']).values
    y = df['y'].values
    model = Ridge(alpha=1.0)
    model.fit(X, y)

    current_inputs = list(series.iloc[-12:].values[::-1])
    predictions = []

    for _ in range(n):
        pred = model.predict([current_inputs])[0]
        predictions.append(pred)
        current_inputs = [pred] + current_inputs[:-1]

    future_index = pd.date_range(start=series.index[-1] + pd.offsets.MonthBegin(1), periods=n, freq="MS")
    return pd.Series(predictions, index=future_index)


def croston_prediction(series: pd.Series, n: int) -> pd.Series:
    zero_fraction = (series == 0).sum() / len(series)

    if zero_fraction > 0.15:
        y = series.values

        nonzero_indices = np.where(y != 0)[0]

        if len(nonzero_indices) < 2:
            return SimpleExpSmoothing(series).fit().forecast(n)

        z = y[nonzero_indices]
        p = np.diff(np.insert(nonzero_indices, 0, -1))
        alpha = 0.2

        z_fit = np.zeros(len(z))
        p_fit = np.zeros(len(p))
        z_fit[0] = z[0]
        p_fit[0] = p[0]

        for t in range(1, len(z)):
            z_fit[t] = alpha * z[t] + (1 - alpha) * z_fit[t - 1]
            p_fit[t] = alpha * p[t] + (1 - alpha) * p_fit[t - 1]

        croston_val = z_fit[-1] / p_fit[-1] if p_fit[-1] != 0 else 0

        future_index = pd.date_range(start=series.index[-1] + pd.offsets.MonthBegin(1), periods=n, freq="MS")
        return pd.Series([croston_val] * n, index=future_index)

    else:
        model = SimpleExpSmoothing(series)
        fit = model.fit()
        return fit.forecast(n)


def compare_models(data: dict[str, dict[str, float]], n: int) -> pd.DataFrame:
    series = data_transformation(data)

    split_idx = int(len(series) * 0.8)
    split_idx = min(max(split_idx, 1), len(series) - 1)

    train = series.iloc[:split_idx]
    test = series.iloc[split_idx:]

    test_size = len(test)

    models = {
        "Exponential Smoothing": exponential_smoothing,
        "SARIMAX": sarimax_prediction,
        "Prophet": prophet_prediction,
        "STL": stl_decomposition_prediction,
        "Ridge Regression": ridge_regression_prediction,
        "Croston": croston_prediction,
    }

    results = []

    for name, model in models.items():
        start_time = time.perf_counter()
        try:
            prediction = model(train, test_size)

            if isinstance(prediction, pd.DataFrame):
                if "yhat" in prediction.columns:
                    prediction = prediction[["ds", "yhat"]].set_index("ds")["yhat"]
                    prediction = prediction.iloc[-test_size:]
                else:
                    prediction = prediction.iloc[:, 0]

            prediction = prediction.reindex(test.index)

            mae = mean_absolute_error(test, prediction)
            rmse = np.sqrt(mean_squared_error(test, prediction))
            mape = mean_absolute_percentage_error(test, prediction)

            future_prediction = model(series, n)

            if isinstance(future_prediction, pd.DataFrame):
                if "yhat" in future_prediction.columns:
                    future_prediction = (
                        future_prediction[["ds", "yhat"]]
                        .set_index("ds")["yhat"]
                        .iloc[-n:]
                    )
                else:
                    future_prediction = future_prediction.iloc[:, 0]

            elapsed = time.perf_counter() - start_time
            results.append({
                "model": name,
                "MAE": mae,
                "RMSE": rmse,
                "MAPE": mape,
                "time_sec": round(elapsed, 3),
                "forecast": future_prediction,
                "error": None
            })

        except Exception as e:
            elapsed = time.perf_counter() - start_time
            results.append({
                "model": name,
                "MAE": np.nan,
                "RMSE": np.nan,
                "MAPE": np.nan,
                "time_sec": round(elapsed, 3),
                "forecast": None,
                "error": str(e)
            })
    return (
        pd.DataFrame(results)
        .sort_values("RMSE")
        .reset_index(drop=True)
    )

import sympy as sp
import re
from collections import defaultdict


def compute_drivers(formula, data, return_percent=False):
    left_str, right_str = formula.split('=')
    target_name = left_str.strip()

    name_to_alias = {}
    alias_to_name = {}
    for idx, name in enumerate(data.keys()):
        alias = f"VAR_{idx}"
        name_to_alias[name] = alias
        alias_to_name[alias] = name

    if target_name not in name_to_alias:
        name_to_alias[target_name] = "TARGET_VAR"
        alias_to_name["TARGET_VAR"] = target_name

    sorted_names = sorted(name_to_alias.keys(), key=len, reverse=True)
    pattern = re.compile("|".join(re.escape(n) for n in sorted_names))
    safe_right = pattern.sub(lambda m: name_to_alias[m.group(0)], right_str)

    safe_data = {name_to_alias[name]: ts for name, ts in data.items()}

    expr = sp.parse_expr(safe_right.strip())
    drivers = [str(s) for s in expr.free_symbols]
    if not drivers:
        raise ValueError("В формуле нет переменных.")

    derivatives = {var: sp.diff(expr, var) for var in drivers}
    ordered_symbols = [sp.Symbol(v) for v in drivers]

    eval_expr = sp.lambdify(ordered_symbols, expr, 'math')
    eval_diffs = {var: sp.lambdify(ordered_symbols, derivatives[var], 'math') for var in drivers}

    first_driver = drivers[0]
    time_keys = []
    for year in sorted(safe_data[first_driver].keys()):
        for month in sorted(safe_data[first_driver][year].keys()):
            time_keys.append((year, month))

    total_contrib = defaultdict(float)

    for i in range(1, len(time_keys)):
        t_prev = time_keys[i-1]
        t_curr = time_keys[i]

        vals_prev = {v: safe_data[v][t_prev[0]][t_prev[1]] for v in drivers}
        vals_curr = {v: safe_data[v][t_curr[0]][t_curr[1]] for v in drivers}

        args_prev = [vals_prev[v] for v in drivers]
        args_curr = [vals_curr[v] for v in drivers]

        y_prev = eval_expr(*args_prev)
        y_curr = eval_expr(*args_curr)
        actual_delta = y_curr - y_prev

        midpoints = {v: (vals_prev[v] + vals_curr[v]) / 2.0 for v in drivers}
        args_mid = [midpoints[v] for v in drivers]

        raw_contrib = {}
        for v in drivers:
            deriv = eval_diffs[v](*args_mid)
            raw_contrib[v] = deriv * (vals_curr[v] - vals_prev[v])

        sum_raw = sum(raw_contrib.values())
        residual = actual_delta - sum_raw

        sum_abs_raw = sum(abs(raw_contrib[v]) for v in drivers)
        if sum_abs_raw > 1e-12:
            for v in drivers:
                weight = abs(raw_contrib[v]) / sum_abs_raw
                total_contrib[v] += raw_contrib[v] + residual * weight
        else:
            for v in drivers:
                total_contrib[v] += raw_contrib[v] + residual / len(drivers)

    abs_result = {alias_to_name[alias]: contrib for alias, contrib in total_contrib.items()}

    if not return_percent:
        return abs_result

    total_abs = sum(abs(v) for v in abs_result.values())
    if total_abs < 1e-12:
        percent_result = {k: 0.0 for k in abs_result}
    else:
        percent_result = {k: (v / total_abs) * 100.0 for k, v in abs_result.items()}

    return {
        'absolute': abs_result,
        'percent': percent_result
    }


# ------------------------------------------------------------
# Пример
# ------------------------------------------------------------
# Вспомогательная функция для расчёта дохода по трём факторам
def calc_income(clients, check, conversion):
    return clients * check * conversion

if __name__ == "__main__":
    import random
    random.seed(42)

    # ------------------- ТЕСТ 1: РОСТ ДОХОДА -------------------
    print("=" * 60)
    print("ТЕСТ 1: РОСТ ДОХОДА (2024–2026)")
    print("=" * 60)

    years = [2024, 2025, 2026]
    months = list(range(1, 13))

    base_clients = 1000
    base_check = 500
    base_conversion = 0.80

    clients_growth = 0.05
    check_growth = 0.03
    conversion_growth = 0.02

    seasonal = [0.95, 0.90, 0.92, 0.98, 1.05, 1.10, 1.08, 1.02, 0.97, 0.96, 1.02, 1.12]

    test_data_up = {
        'Кол-во клиентов': {},
        'Средний чек': {},
        'Конверсия (%)': {}
    }

    for y in years:
        year_factor = 1 + (y - 2024) * 0.05
        for m in months:
            noise_clients = 1 + random.uniform(-0.02, 0.02)
            noise_check = 1 + random.uniform(-0.02, 0.02)
            noise_conversion = 1 + random.uniform(-0.02, 0.02)

            clients = base_clients * year_factor * seasonal[m-1] * noise_clients
            check = base_check * (1 + check_growth)**(y-2024) * (1 + 0.01 * (m-1)/12) * noise_check
            conversion = base_conversion * (1 + conversion_growth)**(y-2024) * (1 + 0.005 * (m-1)/12) * noise_conversion

            test_data_up['Кол-во клиентов'].setdefault(y, {})[m] = round(clients, 0)
            test_data_up['Средний чек'].setdefault(y, {})[m] = round(check, 2)
            test_data_up['Конверсия (%)'].setdefault(y, {})[m] = round(conversion, 4)

    formula = "Доход = Кол-во клиентов * Средний чек * Конверсия (%)"
    result_up = compute_drivers(formula, test_data_up, return_percent=True)

    first_year = min(test_data_up['Кол-во клиентов'].keys())
    first_month = min(test_data_up['Кол-во клиентов'][first_year].keys())
    last_year = max(test_data_up['Кол-во клиентов'].keys())
    last_month = max(test_data_up['Кол-во клиентов'][last_year].keys())

    income_first_up = calc_income(
        test_data_up['Кол-во клиентов'][first_year][first_month],
        test_data_up['Средний чек'][first_year][first_month],
        test_data_up['Конверсия (%)'][first_year][first_month]
    )
    income_last_up = calc_income(
        test_data_up['Кол-во клиентов'][last_year][last_month],
        test_data_up['Средний чек'][last_year][last_month],
        test_data_up['Конверсия (%)'][last_year][last_month]
    )

    print(f"Период: {first_month}.{first_year} – {last_month}.{last_year}")
    print(f"Доход в начале: {income_first_up:,.2f} руб.")
    print(f"Доход в конце:   {income_last_up:,.2f} руб.")
    print(f"Изменение дохода: {income_last_up - income_first_up:+,.2f} руб.\n")

    print("АБСОЛЮТНЫЕ ВКЛАДЫ (руб.):")
    for k, v in result_up['absolute'].items():
        print(f"  {k}: {v:+,.2f}")

    print("\nПРОЦЕНТНЫЕ ВКЛАДЫ (доля в изменении дохода):")
    for k, v in result_up['percent'].items():
        print(f"  {k}: {v:+.1f}%")

    sum_percent_up = sum(result_up['percent'].values())
    print(f"\nСумма процентов: {sum_percent_up:+.1f}%  (должно быть 100%)")

    sum_abs_up = sum(result_up['absolute'].values())
    delta_income_up = income_last_up - income_first_up
    print(f"\nБАЛАНС: сумма вкладов = {sum_abs_up:+.2f} руб., изменение дохода = {delta_income_up:+.2f} руб.")
    print("✅ Баланс сошёлся!" if abs(sum_abs_up - delta_income_up) < 1e-6 else "❌ Ошибка баланса!")

    # ------------------- ТЕСТ 2: ПАДЕНИЕ ДОХОДА -------------------
    print("\n" + "=" * 60)
    print("ТЕСТ 2: ПАДЕНИЕ ДОХОДА (2024–2026)")
    print("=" * 60)

    # Генерируем данные с падением
    clients_growth_fall = -0.05
    check_growth_fall = -0.03
    conversion_growth_fall = 0.02  # растёт, но не спасает

    test_data_down = {
        'Кол-во клиентов': {},
        'Средний чек': {},
        'Конверсия (%)': {}
    }

    for y in years:
        year_factor = 1 + (y - 2024) * clients_growth_fall
        for m in months:
            noise_clients = 1 + random.uniform(-0.02, 0.02)
            noise_check = 1 + random.uniform(-0.02, 0.02)
            noise_conversion = 1 + random.uniform(-0.02, 0.02)

            clients = base_clients * year_factor * seasonal[m-1] * noise_clients
            check = base_check * (1 + check_growth_fall)**(y-2024) * (1 + 0.01 * (m-1)/12) * noise_check
            conversion = base_conversion * (1 + conversion_growth_fall)**(y-2024) * (1 + 0.005 * (m-1)/12) * noise_conversion

            test_data_down['Кол-во клиентов'].setdefault(y, {})[m] = round(clients, 0)
            test_data_down['Средний чек'].setdefault(y, {})[m] = round(check, 2)
            test_data_down['Конверсия (%)'].setdefault(y, {})[m] = round(conversion, 4)

    result_down = compute_drivers(formula, test_data_down, return_percent=True)

    first_year = min(test_data_down['Кол-во клиентов'].keys())
    first_month = min(test_data_down['Кол-во клиентов'][first_year].keys())
    last_year = max(test_data_down['Кол-во клиентов'].keys())
    last_month = max(test_data_down['Кол-во клиентов'][last_year].keys())

    income_first_down = calc_income(
        test_data_down['Кол-во клиентов'][first_year][first_month],
        test_data_down['Средний чек'][first_year][first_month],
        test_data_down['Конверсия (%)'][first_year][first_month]
    )
    income_last_down = calc_income(
        test_data_down['Кол-во клиентов'][last_year][last_month],
        test_data_down['Средний чек'][last_year][last_month],
        test_data_down['Конверсия (%)'][last_year][last_month]
    )

    print(f"Период: {first_month}.{first_year} – {last_month}.{last_year}")
    print(f"Доход в начале: {income_first_down:,.2f} руб.")
    print(f"Доход в конце:   {income_last_down:,.2f} руб.")
    print(f"Изменение дохода: {income_last_down - income_first_down:+,.2f} руб.\n")

    print("АБСОЛЮТНЫЕ ВКЛАДЫ (руб.):")
    for k, v in result_down['absolute'].items():
        print(f"  {k}: {v:+,.2f}")

    print("\nПРОЦЕНТНЫЕ ВКЛАДЫ (доля в изменении дохода):")
    for k, v in result_down['percent'].items():
        print(f"  {k}: {v:+.1f}%")

    sum_percent_down = sum(result_down['percent'].values())
    print(f"\nСумма процентов: {sum_percent_down:+.1f}%  (должно быть -100%)")

    sum_abs_down = sum(result_down['absolute'].values())
    delta_income_down = income_last_down - income_first_down
    print(f"\nБАЛАНС: сумма вкладов = {sum_abs_down:+.2f} руб., изменение дохода = {delta_income_down:+.2f} руб.")
    print("✅ Баланс сошёлся!" if abs(sum_abs_down - delta_income_down) < 1e-6 else "❌ Ошибка баланса!")
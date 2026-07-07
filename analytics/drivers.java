import javax.script.ScriptEngine;
import javax.script.ScriptEngineManager;
import javax.script.ScriptException;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class DriverCalculator {

    public static Object computeDrivers(String formula,
                                        Map<String, Map<Integer, Map<Integer, Double>>> data,
                                        boolean returnPercent) throws ScriptException {

        // 1. Разбор формулы
        String[] parts = formula.split("=");
        String leftStr = parts[0].trim();
        String rightStr = parts[1].trim();

        // 2. Маппинг имён -> алиасы
        Map<String, String> nameToAlias = new LinkedHashMap<>();
        Map<String, String> aliasToName = new LinkedHashMap<>();
        int idx = 0;
        for (String name : data.keySet()) {
            String alias = "VAR_" + idx++;
            nameToAlias.put(name, alias);
            aliasToName.put(alias, name);
        }
        if (!nameToAlias.containsKey(leftStr)) {
            nameToAlias.put(leftStr, "TARGET_VAR");
            aliasToName.put("TARGET_VAR", leftStr);
        }

        // 3. Замена имён в формуле (от длинных к коротким)
        List<String> sortedNames = new ArrayList<>(nameToAlias.keySet());
        sortedNames.sort((a, b) -> Integer.compare(b.length(), a.length()));
        String patternStr = String.join("|", sortedNames.stream()
                .map(Pattern::quote)
                .toArray(String[]::new));
        Pattern pattern = Pattern.compile(patternStr);
        Matcher matcher = pattern.matcher(rightStr);
        StringBuffer sb = new StringBuffer();
        while (matcher.find()) {
            matcher.appendReplacement(sb, nameToAlias.get(matcher.group()));
        }
        matcher.appendTail(sb);
        String safeRight = sb.toString();

        // 4. Переводим данные в алиасы
        Map<String, Map<Integer, Map<Integer, Double>>> safeData = new LinkedHashMap<>();
        for (Map.Entry<String, Map<Integer, Map<Integer, Double>>> entry : data.entrySet()) {
            safeData.put(nameToAlias.get(entry.getKey()), entry.getValue());
        }

        // 5. Определяем драйверы
        Set<String> driversSet = new LinkedHashSet<>();
        for (String alias : nameToAlias.values()) {
            if (!alias.equals("TARGET_VAR") && safeData.containsKey(alias)) {
                driversSet.add(alias);
            }
        }
        List<String> drivers = new ArrayList<>(driversSet);
        if (drivers.isEmpty()) {
            throw new IllegalArgumentException("В формуле нет переменных.");
        }

        // 6. Временная шкала
        Set<String> timeStrings = null;
        for (String v : drivers) {
            Set<String> vTimes = new HashSet<>();
            Map<Integer, Map<Integer, Double>> vData = safeData.get(v);
            if (vData != null) {
                for (int year : vData.keySet()) {
                    for (int month : vData.get(year).keySet()) {
                        vTimes.add(year + "-" + month);
                    }
                }
            }
            if (timeStrings == null) {
                timeStrings = vTimes;
            } else {
                timeStrings.retainAll(vTimes);
            }
        }

        List<int[]> timeKeys = new ArrayList<>();
        if (timeStrings != null) {
            List<String> sortedTimes = new ArrayList<>(timeStrings);
            sortedTimes.sort((a, b) -> {
                String[] p1 = a.split("-");
                String[] p2 = b.split("-");
                int yComp = Integer.compare(Integer.parseInt(p1[0]), Integer.parseInt(p2[0]));
                if (yComp != 0) return yComp;
                return Integer.compare(Integer.parseInt(p1[1]), Integer.parseInt(p2[1]));
            });
            for (String t : sortedTimes) {
                String[] p = t.split("-");
                timeKeys.add(new int[]{Integer.parseInt(p[0]), Integer.parseInt(p[1])});
            }
        }

        if (timeKeys.size() < 2) {
            throw new IllegalArgumentException("Нужно минимум 2 общих месяца данных для всех факторов.");
        }

        // 7. Подготовка ScriptEngine
        ScriptEngine engine = new ScriptEngineManager().getEngineByName("JavaScript");
        if (engine == null) {
            throw new RuntimeException("JavaScript-движок не найден. Проверьте версию Java (требуется < 15 или GraalVM JS).");
        }

        // 8. Накопление вкладов
        Map<String, Double> totalContrib = new HashMap<>();
        for (String v : drivers) totalContrib.put(v, 0.0);

        final double EPS = 1e-8;

        // 9. Помесячный цикл
        for (int i = 1; i < timeKeys.size(); i++) {
            int[] tPrev = timeKeys.get(i - 1);
            int[] tCurr = timeKeys.get(i);

            Map<String, Double> valsPrev = new HashMap<>();
            Map<String, Double> valsCurr = new HashMap<>();
            for (String v : drivers) {
                valsPrev.put(v, safeData.get(v).get(tPrev[0]).get(tPrev[1]));
                valsCurr.put(v, safeData.get(v).get(tCurr[0]).get(tCurr[1]));
            }

            javax.script.Bindings bindingsPrev = engine.createBindings();
            javax.script.Bindings bindingsCurr = engine.createBindings();
            for (String v : drivers) {
                bindingsPrev.put(v, valsPrev.get(v));
                bindingsCurr.put(v, valsCurr.get(v));
            }

            double yPrev = evalExpression(engine, safeRight, bindingsPrev);
            double yCurr = evalExpression(engine, safeRight, bindingsCurr);
            double actualDelta = yCurr - yPrev;

            Map<String, Double> midpoints = new HashMap<>();
            Map<String, Double> deltas = new HashMap<>();
            for (String v : drivers) {
                double p = valsPrev.get(v);
                double c = valsCurr.get(v);
                midpoints.put(v, (p + c) / 2.0);
                deltas.put(v, c - p);
            }

            Map<String, Double> rawContrib = new HashMap<>();
            for (String v : drivers) {
                double midVal = midpoints.get(v);
                javax.script.Bindings bindingsMid = engine.createBindings();
                for (String dv : drivers) {
                    bindingsMid.put(dv, midpoints.get(dv));
                }

                double eps = Math.max(EPS, Math.abs(midVal) * 1e-7);
                bindingsMid.put(v, midVal + eps);
                double fPlus = evalExpression(engine, safeRight, bindingsMid);

                bindingsMid.put(v, midVal - eps);
                double fMinus = evalExpression(engine, safeRight, bindingsMid);

                double deriv = (fPlus - fMinus) / (2 * eps);
                rawContrib.put(v, deriv * deltas.get(v));
            }

            double sumRaw = 0.0;
            for (double val : rawContrib.values()) sumRaw += val;
            double residual = actualDelta - sumRaw;

            double sumAbsRaw = 0.0;
            for (double val : rawContrib.values()) sumAbsRaw += Math.abs(val);
            for (String v : drivers) {
                double raw = rawContrib.get(v);
                double adjusted;
                if (sumAbsRaw > 1e-12) {
                    double weight = Math.abs(raw) / sumAbsRaw;
                    adjusted = raw + residual * weight;
                } else {
                    adjusted = raw + residual / drivers.size();
                }
                totalContrib.put(v, totalContrib.get(v) + adjusted);
            }
        }

        // 10. Обратный маппинг алиасов -> бизнес-имена
        Map<String, Double> absResult = new LinkedHashMap<>();
        for (Map.Entry<String, Double> entry : totalContrib.entrySet()) {
            absResult.put(aliasToName.get(entry.getKey()), entry.getValue());
        }

        // 11. Возврат
        if (!returnPercent) {
            return absResult;
        }

        double totalAbs = 0.0;
        for (double v : absResult.values()) totalAbs += Math.abs(v);
        Map<String, Double> percentResult = new LinkedHashMap<>();
        for (Map.Entry<String, Double> entry : absResult.entrySet()) {
            percentResult.put(entry.getKey(), totalAbs < 1e-12 ? 0.0 : (entry.getValue() / totalAbs) * 100.0);
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("absolute", absResult);
        result.put("percent", percentResult);
        return result;
    }

    private static double evalExpression(ScriptEngine engine, String expr, javax.script.Bindings bindings) throws ScriptException {
        Object result = engine.eval(expr, bindings);
        if (result instanceof Number) {
            return ((Number) result).doubleValue();
        }
        throw new ScriptException("Результат выражения не является числовым значением: " + result);
    }

    public static void main(String[] args) throws ScriptException {
        Map<String, Map<Integer, Map<Integer, Double>>> testData = new LinkedHashMap<>();

        testData.put("Кол-во клиентов", new LinkedHashMap<>() {{
            put(2026, new LinkedHashMap<>() {{ put(1, 1000.0); put(2, 1050.0); }});
        }});
        testData.put("Средний чек", new LinkedHashMap<>() {{
            put(2026, new LinkedHashMap<>() {{ put(1, 500.0); put(2, 480.0); }});
        }});
        testData.put("Конверсия (%)", new LinkedHashMap<>() {{
            put(2026, new LinkedHashMap<>() {{ put(1, 0.80); put(2, 0.85); }});
        }});

        String formula = "Доход = Кол-во клиентов * Средний чек * Конверсия (%)";

        Object result = computeDrivers(formula, testData, true);
        System.out.println(result);
    }
}
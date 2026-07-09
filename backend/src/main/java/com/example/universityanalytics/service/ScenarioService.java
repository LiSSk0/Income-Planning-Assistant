package com.example.universityanalytics.service;

import com.example.universityanalytics.dto.*;
import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.entity.ScenarioEntity;
import com.example.universityanalytics.repository.FactRepository;
import com.example.universityanalytics.repository.ScenarioRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScenarioService {

    private static final Logger log = LoggerFactory.getLogger(ScenarioService.class);
    private static final String DEFAULT_USER = "default";

    private final ScenarioRepository scenarioRepository;
    private final FactRepository factRepository;
    private final PythonClientService pythonClientService;
    private final GraphService graphService;
    private final ObjectMapper objectMapper;

    public List<ScenarioDto> getScenarios() {
        return getScenarios(DEFAULT_USER);
    }

    public List<ScenarioDto> getScenarios(String userId) {
        return scenarioRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream().map(this::fromEntity).collect(Collectors.toList());
    }

    @Transactional
    public void deleteScenario(String id) {
        scenarioRepository.deleteById(id);
    }

    @Transactional
    public ScenarioDto generateScenario(ScenarioParamsDto params) {
        return generateScenario(params, DEFAULT_USER);
    }

    @Transactional
    public ScenarioDto generateScenario(ScenarioParamsDto params, String userId) {
        if (userId == null) userId = DEFAULT_USER;

        // 1. Определяем список регионов
        List<String> regions = params.getRegions();
        if (regions == null || regions.isEmpty() || regions.contains("all")) {
            regions = factRepository.findDistinctSubjects();
        } else {
            regions = regions.stream().filter(r -> !"all".equals(r)).collect(Collectors.toList());
            if (regions.isEmpty()) {
                regions = factRepository.findDistinctSubjects();
            }
        }

        log.info("Регионы для прогноза: {}", regions);

        // 2. Получаем граф
        BusinessGraphDto graph = graphService.getGraph(userId);
        Map<String, GraphNodeDto> nodeMap = graph.getNodes().stream()
                .collect(Collectors.toMap(GraphNodeDto::getId, n -> n));

        // 3. Находим целевой узел
        String targetId = nodeMap.entrySet().stream()
                .filter(e -> e.getValue().getIndicator().equals(params.getTargetIndicator()))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);

        boolean isDerived = targetId != null && nodeMap.get(targetId).getIsDerived() != null && nodeMap.get(targetId).getIsDerived();
        boolean useDirectForecast = params.getUseDirectForecast() != null && params.getUseDirectForecast();

        // 4. Определяем, какие показатели прогнозировать напрямую
        Set<String> baseIndicators = new HashSet<>();
        boolean directForecast = useDirectForecast || !isDerived || targetId == null;
        if (!directForecast) {
            collectBaseIndicators(targetId, nodeMap, graph, baseIndicators);
        } else {
            baseIndicators.add(params.getTargetIndicator());
        }

        log.info("Для целевого {} базовые: {}", params.getTargetIndicator(), baseIndicators);

        // 5. Для каждого региона и каждого базового показателя получаем прогнозы
        Map<String, Map<String, List<ModelForecastDto>>> regionBaseForecasts = new LinkedHashMap<>();
        Map<String, String> regionErrors = new HashMap<>();

        for (String region : regions) {
            log.info("Обработка региона: {}", region);
            List<FactEntity> regionFacts = factRepository.findBySubject(region);
            if (regionFacts.isEmpty()) {
                regionErrors.put(region, "Нет данных для региона");
                log.warn("Нет данных для региона: {}", region);
                continue;
            }

            Map<String, List<ModelForecastDto>> indicatorForecasts = new LinkedHashMap<>();
            for (String indicator : baseIndicators) {
                log.info("  Прогноз для показателя: {} в регионе {}", indicator, region);
                List<ModelForecastDto> models = forecastIndicator(region, indicator, params.getHorizonMonths());
                if (!models.isEmpty()) {
                    indicatorForecasts.put(indicator, models);
                    log.info("  Получено {} моделей для {} в {}", models.size(), indicator, region);
                } else {
                    log.warn("  Не удалось получить прогноз для {} в {}", indicator, region);
                }
            }

            if (!indicatorForecasts.isEmpty()) {
                regionBaseForecasts.put(region, indicatorForecasts);
            } else {
                regionErrors.put(region, "Не удалось получить прогнозы для базовых показателей");
            }
        }

        if (regionBaseForecasts.isEmpty()) {
            String errorMsg = "Не удалось получить прогноз для выбранных регионов. Ошибки: " + regionErrors;
            log.error(errorMsg);
            throw new RuntimeException(errorMsg);
        }

        // 6. Вычисляем целевой (по формулам или прямой прогноз)
        Map<String, List<ModelForecastDto>> regionTargetForecasts = new LinkedHashMap<>();

        for (String region : regionBaseForecasts.keySet()) {
            Map<String, List<ModelForecastDto>> baseForecasts = regionBaseForecasts.get(region);
            if (baseForecasts == null || baseForecasts.isEmpty()) continue;

            if (!directForecast) {
                // Вычисляем через формулы
                List<ModelForecastDto> firstModelList = baseForecasts.values().iterator().next();
                List<ModelForecastDto> targetModels = new ArrayList<>();

                for (int i = 0; i < firstModelList.size(); i++) {
                    ModelForecastDto model = firstModelList.get(i);
                    Map<String, Map<String, Double>> baseForecastValues = new HashMap<>();

                    for (Map.Entry<String, List<ModelForecastDto>> entry : baseForecasts.entrySet()) {
                        String ind = entry.getKey();
                        List<ModelForecastDto> models = entry.getValue();
                        if (i < models.size()) {
                            baseForecastValues.put(ind, models.get(i).getForecast());
                        }
                    }

                    Map<String, Double> targetForecast = computeTargetFromFormulas(targetId, nodeMap, graph, baseForecastValues);
                    ModelForecastDto targetModel = new ModelForecastDto();
                    targetModel.setName(model.getName());
                    targetModel.setRank(model.getRank());
                    targetModel.setMetrics(model.getMetrics());
                    targetModel.setForecast(targetForecast);
                    targetModels.add(targetModel);
                }

                regionTargetForecasts.put(region, targetModels);
            } else {
                // Прямой прогноз целевого
                List<ModelForecastDto> targetModels = baseForecasts.get(params.getTargetIndicator());
                if (targetModels != null && !targetModels.isEmpty()) {
                    regionTargetForecasts.put(region, targetModels);
                }
            }
        }

        if (regionTargetForecasts.isEmpty()) {
            String errorMsg = "Не удалось вычислить целевой показатель для регионов. Ошибки: " + regionErrors;
            log.error(errorMsg);
            throw new RuntimeException(errorMsg);
        }

        // 7. Собираем DTO
        ScenarioDto dto = new ScenarioDto();
        dto.setId(UUID.randomUUID().toString());
        dto.setTitle(params.getName());
        dto.setDescription("Прогноз до " + params.getHorizonMonths() + " мес.");
        dto.setParams(params);
        dto.setStatus("ready");
        dto.setTargetIndicator(params.getTargetIndicator());
        dto.setRegions(new ArrayList<>(regionTargetForecasts.keySet()));
        dto.setRegionForecasts(regionTargetForecasts);

        // 8. Вычисляем СКО, byRegion и исторические данные для графиков
        Map<String, Double> stdDevMap = new LinkedHashMap<>();
        Map<String, ScenarioStdDevDto> stdDevDetails = new LinkedHashMap<>();
        List<ScenarioRegionValueDto> byRegionList = new ArrayList<>();

        // Собираем исторические данные по регионам для целевого показателя
        Map<String, List<ScenarioPointDto>> historyByRegion = new LinkedHashMap<>();
        for (String region : regions) {
            List<FactEntity> regionFacts = factRepository.findBySubject(region);
            List<ScenarioPointDto> history = regionFacts.stream()
                    .filter(f -> f.getIndicator().equals(params.getTargetIndicator()))
                    .sorted(Comparator.comparing(FactEntity::getPeriod))
                    .map(f -> new ScenarioPointDto(f.getPeriod(), f.getValue()))
                    .collect(Collectors.toList());
            historyByRegion.put(region, history);
        }

        for (String region : regionTargetForecasts.keySet()) {
            // СКО по алгоритму из CKO.py
            double std = calculateStdDev(region, params.getTargetIndicator());
            stdDevMap.put(region, std);

            // Доверительный интервал для прогноза (используем первую модель)
            List<ModelForecastDto> models = regionTargetForecasts.get(region);
            if (models != null && !models.isEmpty()) {
                ModelForecastDto firstModel = models.get(0);
                Map<String, Double> forecast = firstModel.getForecast();
                if (forecast != null && !forecast.isEmpty()) {
                    String lastPeriod = forecast.keySet().stream().max(String::compareTo).orElse(null);
                    if (lastPeriod != null) {
                        Double lastValue = forecast.get(lastPeriod);
                        byRegionList.add(new ScenarioRegionValueDto(region, lastValue));
                    }

                    // Доверительный интервал для прогноза: используем СКО и нормальное распределение (z=1.96 для 95%)
                    double z = 1.96;
                    Map<String, Double> lowerBounds = new LinkedHashMap<>();
                    Map<String, Double> upperBounds = new LinkedHashMap<>();
                    for (Map.Entry<String, Double> entry : forecast.entrySet()) {
                        double val = entry.getValue();
                        double interval = z * std;
                        lowerBounds.put(entry.getKey(), val - interval);
                        upperBounds.put(entry.getKey(), val + interval);
                    }
                    stdDevDetails.put(region, new ScenarioStdDevDto(std, lowerBounds, upperBounds));
                }
            }
        }
        dto.setStdDevByRegion(stdDevMap);
        dto.setStdDevDetails(stdDevDetails);
        dto.setByRegion(byRegionList);
        dto.setHistoryByRegion(historyByRegion);

        double avgStd = computeAverageStd(regionTargetForecasts);
        dto.setGrowthRateStd(avgStd);
        dto.setDrivers(new ArrayList<>());

        // Сохраняем
        ScenarioEntity entity = toEntity(dto);
        entity.setUserId(userId);
        scenarioRepository.save(entity);

        log.info("Сценарий {} успешно создан для {} регионов", dto.getId(), regionTargetForecasts.size());
        return dto;
    }

    public Map<String, Double> calculateDrivers(String scenarioId, String region) {
        // 1. Получаем сценарий
        ScenarioDto scenario = getScenarioById(scenarioId);
        if (scenario == null) return Collections.emptyMap();

        // 2. Получаем прогнозы для региона
        Map<String, List<ModelForecastDto>> regionForecasts = scenario.getRegionForecasts();
        if (regionForecasts == null || !regionForecasts.containsKey(region)) {
            return Collections.emptyMap();
        }

        // 3. Берём лучшую модель (ранг 1)
        List<ModelForecastDto> models = regionForecasts.get(region);
        ModelForecastDto bestModel = models.stream()
                .filter(m -> m.getRank() != null && m.getRank() == 1)
                .findFirst()
                .orElse(models.get(0));

        Map<String, Double> forecast = bestModel.getForecast();
        if (forecast == null || forecast.isEmpty()) return Collections.emptyMap();

        // 4. Определяем базовые показатели для целевого через граф
        BusinessGraphDto graph = graphService.getGraph();
        Map<String, GraphNodeDto> nodeMap = graph.getNodes().stream()
                .collect(Collectors.toMap(GraphNodeDto::getId, n -> n));

        String targetId = nodeMap.entrySet().stream()
                .filter(e -> e.getValue().getIndicator().equals(scenario.getTargetIndicator()))
                .map(Map.Entry::getKey)
                .findFirst()
                .orElse(null);

        if (targetId == null) return Collections.emptyMap();

        Set<String> baseIndicators = new HashSet<>();
        collectBaseIndicators(targetId, nodeMap, graph, baseIndicators);

        // 5. Берём фактические данные для базовых показателей из БД
        Map<String, Double> baseStart = new HashMap<>();
        Map<String, Double> baseEnd = new HashMap<>();

        for (String indicator : baseIndicators) {
            List<FactEntity> facts = factRepository.findBySubject(region);
            List<FactEntity> filtered = facts.stream()
                    .filter(f -> f.getIndicator().equals(indicator))
                    .sorted(Comparator.comparing(FactEntity::getPeriod))
                    .collect(Collectors.toList());

            if (filtered.size() >= 2) {
                baseStart.put(indicator, filtered.get(0).getValue());
                baseEnd.put(indicator, filtered.get(filtered.size() - 1).getValue());
            }
        }

        // 6. Вычисляем изменение целевого показателя
        Double targetStart = baseStart.values().stream().mapToDouble(Double::doubleValue).sum();
        Double targetEnd = baseEnd.values().stream().mapToDouble(Double::doubleValue).sum();
        double targetDelta = targetEnd - targetStart;

        if (Math.abs(targetDelta) < 1e-9) return Collections.emptyMap();

        // 7. Для каждого базового показателя вычисляем вклад
        Map<String, Double> driverContributions = new LinkedHashMap<>();

        for (String indicator : baseIndicators) {
            Double startVal = baseStart.getOrDefault(indicator, 0.0);
            Double endVal = baseEnd.getOrDefault(indicator, 0.0);
            double delta = endVal - startVal;

            // Вычисляем вклад с учётом производной (упрощённо: пропорционально изменению)
            double contribution = (delta / Math.abs(targetDelta)) * 100;
            driverContributions.put(indicator, contribution);
        }

        // Нормализуем, чтобы сумма была 100%
        double sum = driverContributions.values().stream().mapToDouble(Double::doubleValue).sum();
        if (Math.abs(sum) > 1e-9) {
            for (Map.Entry<String, Double> entry : driverContributions.entrySet()) {
                entry.setValue(entry.getValue() / sum * 100);
            }
        }

        return driverContributions;
    }

    // Вспомогательный метод для получения сценария по ID
    private ScenarioDto getScenarioById(String id) {
        return scenarioRepository.findById(id)
                .map(this::fromEntity)
                .orElse(null);
    }


    // ===== Приватные методы =====

    private List<ModelForecastDto> forecastIndicator(String region, String indicator, int horizon) {
        List<FactEntity> facts = factRepository.findBySubject(region);
        Map<Integer, Map<Integer, Double>> history = buildHistory(facts, indicator);

        if (history.isEmpty()) {
            log.warn("Нет истории для {} в {}", indicator, region);
            return Collections.emptyList();
        }

        int totalPoints = history.values().stream().mapToInt(Map::size).sum();
        if (totalPoints < 5) {
            log.warn("Недостаточно данных для {} в {} ({} точек). Минимум 5.", indicator, region, totalPoints);
            return Collections.emptyList();
        }

        log.info("Вызов Python для {} в {}, точек: {}", indicator, region, totalPoints);

        JsonNode result = pythonClientService.callPredict(region, indicator, horizon, "best", history);
        if (result == null) {
            log.error("Python вернул null для {} в {}", indicator, region);
            return Collections.emptyList();
        }

        JsonNode modelsNode = result.path("models");
        if (!modelsNode.isArray() || modelsNode.size() == 0) {
            log.error("Нет моделей в ответе для {} в {}", indicator, region);
            return Collections.emptyList();
        }

        List<ModelForecastDto> models = new ArrayList<>();
        for (JsonNode modelNode : modelsNode) {
            ModelForecastDto dto = new ModelForecastDto();
            dto.setName(modelNode.path("name").asText());
            dto.setRank(modelNode.path("best").asInt(0));

            Map<String, Double> metrics = new HashMap<>();
            JsonNode metricsNode = modelNode.path("metrics");
            metrics.put("MAE", metricsNode.path("MAE").asDouble());
            metrics.put("RMSE", metricsNode.path("RMSE").asDouble());
            metrics.put("MAPE", metricsNode.path("MAPE").asDouble());
            dto.setMetrics(metrics);

            Map<String, Double> forecast = new LinkedHashMap<>();
            JsonNode forecastNode = modelNode.path("forecast");
            if (forecastNode != null && forecastNode.isObject()) {
                forecastNode.fields().forEachRemaining(entry -> {
                    String date = entry.getKey();
                    if (date.length() >= 7) date = date.substring(0, 7);
                    forecast.put(date, entry.getValue().asDouble());
                });
            }
            dto.setForecast(forecast);
            models.add(dto);
        }

        log.info("Получено {} моделей для {} в {}", models.size(), indicator, region);
        return models;
    }

    private void collectBaseIndicators(String nodeId, Map<String, GraphNodeDto> nodeMap,
                                       BusinessGraphDto graph, Set<String> baseIndicators) {
        GraphNodeDto node = nodeMap.get(nodeId);
        if (node == null) return;
        List<GraphEdgeDto> incoming = graph.getEdges().stream()
                .filter(e -> e.getTarget().equals(nodeId))
                .collect(Collectors.toList());
        if (incoming.isEmpty()) {
            baseIndicators.add(node.getIndicator());
        } else {
            for (GraphEdgeDto edge : incoming) {
                collectBaseIndicators(edge.getSource(), nodeMap, graph, baseIndicators);
            }
        }
    }

    private Map<String, Double> computeTargetFromFormulas(String targetId,
                                                          Map<String, GraphNodeDto> nodeMap,
                                                          BusinessGraphDto graph,
                                                          Map<String, Map<String, Double>> baseForecastValues) {
        Set<String> periods = baseForecastValues.values().stream()
                .flatMap(m -> m.keySet().stream())
                .collect(Collectors.toSet());
        Map<String, Double> result = new LinkedHashMap<>();
        for (String period : periods) {
            double value = evaluateNode(targetId, nodeMap, graph, baseForecastValues, period, new HashSet<>());
            result.put(period, value);
        }
        return result;
    }

    private double evaluateNode(String nodeId,
                                Map<String, GraphNodeDto> nodeMap,
                                BusinessGraphDto graph,
                                Map<String, Map<String, Double>> baseForecastValues,
                                String period,
                                Set<String> visited) {
        if (visited.contains(nodeId)) return 0.0;
        visited.add(nodeId);

        GraphNodeDto node = nodeMap.get(nodeId);
        if (node == null) return 0.0;

        List<GraphEdgeDto> incoming = graph.getEdges().stream()
                .filter(e -> e.getTarget().equals(nodeId))
                .collect(Collectors.toList());
        if (incoming.isEmpty()) {
            Map<String, Double> forecast = baseForecastValues.get(node.getIndicator());
            return forecast != null ? forecast.getOrDefault(period, 0.0) : 0.0;
        }

        double result = 0.0;
        boolean first = true;
        for (GraphEdgeDto edge : incoming) {
            double val = evaluateNode(edge.getSource(), nodeMap, graph, baseForecastValues, period, new HashSet<>(visited));
            if (first) {
                result = val;
                first = false;
            } else {
                switch (edge.getOperator()) {
                    case "+": result += val; break;
                    case "-": result -= val; break;
                    case "*": result *= val; break;
                    case "/": if (val != 0) result /= val; break;
                    case "%": if (val != 0) result = result * val / 100.0; break;
                }
            }
        }
        return result;
    }

    private double computeAverageStd(Map<String, List<ModelForecastDto>> regionForecasts) {
        double sum = 0;
        int count = 0;
        for (List<ModelForecastDto> models : regionForecasts.values()) {
            for (ModelForecastDto model : models) {
                Double rmse = model.getMetrics().get("RMSE");
                if (rmse != null) {
                    sum += rmse;
                    count++;
                }
            }
        }
        return count > 0 ? sum / count : 0.0;
    }

    private Map<Integer, Map<Integer, Double>> buildHistory(List<FactEntity> facts, String indicator) {
        Map<Integer, Map<Integer, Double>> history = new LinkedHashMap<>();
        for (FactEntity f : facts) {
            if (!f.getIndicator().equals(indicator)) continue;
            String[] parts = f.getPeriod().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            history.computeIfAbsent(year, k -> new LinkedHashMap<>()).put(month, f.getValue());
        }
        return history;
    }

    /**
     * Расчёт СКО исторических данных по алгоритму из CKO.py (десезонализация и удаление тренда)
     */
    private double calculateStdDev(String region, String indicator) {
        List<FactEntity> facts = factRepository.findBySubject(region);
        if (facts.isEmpty()) return 0.0;

        List<FactEntity> filtered = facts.stream()
                .filter(f -> f.getIndicator().equals(indicator))
                .sorted(Comparator.comparing(FactEntity::getPeriod))
                .collect(Collectors.toList());

        if (filtered.size() < 12) return 0.0;

        // 1. Средние по месяцам
        Map<Integer, Double> monthSums = new HashMap<>();
        Map<Integer, Integer> monthCounts = new HashMap<>();
        for (FactEntity f : filtered) {
            String[] parts = f.getPeriod().split("-");
            int month = Integer.parseInt(parts[1]);
            double val = f.getValue();
            monthSums.put(month, monthSums.getOrDefault(month, 0.0) + val);
            monthCounts.put(month, monthCounts.getOrDefault(month, 0) + 1);
        }

        Map<Integer, Double> monthAvg = new HashMap<>();
        for (int m : monthSums.keySet()) {
            monthAvg.put(m, monthSums.get(m) / monthCounts.get(m));
        }

        double overallAvg = monthAvg.values().stream().mapToDouble(Double::doubleValue).average().orElse(1.0);
        Map<Integer, Double> seasonality = new HashMap<>();
        for (int m : monthAvg.keySet()) {
            seasonality.put(m, overallAvg > 0 ? monthAvg.get(m) / overallAvg : 1.0);
        }

        // 2. Дезонализируем и собираем остатки
        Map<Integer, List<Double>> yearlyDeseasonalized = new HashMap<>();
        for (FactEntity f : filtered) {
            String[] parts = f.getPeriod().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            double val = f.getValue();
            double coef = seasonality.getOrDefault(month, 1.0);
            double deseasonalized = coef != 0 ? val / coef : val;
            yearlyDeseasonalized.computeIfAbsent(year, k -> new ArrayList<>()).add(deseasonalized);
        }

        Map<Integer, Double> yearAvg = new HashMap<>();
        for (int year : yearlyDeseasonalized.keySet()) {
            List<Double> vals = yearlyDeseasonalized.get(year);
            double avg = vals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            yearAvg.put(year, avg);
        }

        List<Double> residuals = new ArrayList<>();
        for (FactEntity f : filtered) {
            String[] parts = f.getPeriod().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            double val = f.getValue();
            double coef = seasonality.getOrDefault(month, 1.0);
            double deseasonalized = coef != 0 ? val / coef : val;
            double yearMean = yearAvg.getOrDefault(year, 0.0);
            residuals.add(deseasonalized - yearMean);
        }

        double mean = residuals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double variance = residuals.stream().mapToDouble(d -> Math.pow(d - mean, 2)).average().orElse(0);
        return Math.sqrt(variance);
    }

    private ScenarioEntity toEntity(ScenarioDto dto) {
        try {
            ScenarioEntity entity = new ScenarioEntity();
            entity.setId(dto.getId());
            entity.setName(dto.getTitle());
            entity.setParamsJson(objectMapper.writeValueAsString(dto.getParams()));
            entity.setResultJson(objectMapper.writeValueAsString(dto));
            entity.setCreatedAt(LocalDateTime.now());
            return entity;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private ScenarioDto fromEntity(ScenarioEntity entity) {
        try {
            return objectMapper.readValue(entity.getResultJson(), ScenarioDto.class);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
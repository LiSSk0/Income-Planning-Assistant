package com.example.universityanalytics.service;

import com.example.universityanalytics.dto.ScenarioResponse;
import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.FactRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class ScenarioService {

    private final FactRepository factRepository;
    private final PythonClientService pythonClientService;
    private final SeasonalityService seasonalityService;

    public ScenarioService(FactRepository factRepository,
                           PythonClientService pythonClientService,
                           SeasonalityService seasonalityService) {
        this.factRepository = factRepository;
        this.pythonClientService = pythonClientService;
        this.seasonalityService = seasonalityService;
    }

    public List<ScenarioResponse> getDefaultScenarios(String subject, String indicator, int horizon) {
        List<ScenarioResponse> scenarios = new ArrayList<>();

        List<FactEntity> facts = factRepository.findBySubject(subject);
        Map<Integer, Map<Integer, Double>> history = buildHistory(facts, indicator);

        if (history.isEmpty()) {
            return createFallbackScenarios(subject, indicator);
        }

        String[] methods = {"sarimax", "prophet", "exponential", "sarimax"};
        String[] types = {"BASELINE", "OPTIMISTIC", "CONSERVATIVE", "AI"};

        for (int i = 0; i < methods.length; i++) {
            JsonNode result = pythonClientService.callPredict(subject, indicator, horizon, methods[i], history);
            if (result != null) {
                scenarios.add(convertToScenario(types[i], result));
            }
        }
        return scenarios;
    }

    public ScenarioResponse computeCustomScenario(String subject, String indicator, int horizon,
                                                  String method, Map<String, Double> multipliers) {
        List<FactEntity> facts = factRepository.findBySubject(subject);
        Map<Integer, Map<Integer, Double>> history = buildHistory(facts, indicator);

        JsonNode result = pythonClientService.callPredict(subject, indicator, horizon, method, history);
        if (result != null) {
            return convertToScenario("CUSTOM", result);
        }

        List<ScenarioResponse.ScenarioPoint> points = new ArrayList<>();
        String[] months = getFutureMonths(horizon);
        double base = history.values().stream()
                .flatMap(m -> m.values().stream())
                .mapToDouble(Double::doubleValue)
                .average()
                .orElse(1000);

        for (int i = 0; i < months.length; i++) {
            double value = base * (1 + i * 0.02);
            points.add(new ScenarioResponse.ScenarioPoint(
                    months[i],
                    value,
                    value * 0.85,
                    value * 1.15
            ));
        }
        return new ScenarioResponse("CUSTOM", "Пользовательский сценарий для " + indicator + " в " + subject, points, 0.12);
    }

    private Map<Integer, Map<Integer, Double>> buildHistory(List<FactEntity> facts, String indicator) {
        Map<Integer, Map<Integer, Double>> history = new HashMap<>();
        for (FactEntity f : facts) {
            if (!f.getIndicator().equals(indicator)) continue;
            String[] parts = f.getPeriod().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            history.computeIfAbsent(year, k -> new HashMap<>()).put(month, f.getValue());
        }
        return history;
    }

    private ScenarioResponse convertToScenario(String type, JsonNode pythonResult) {
        ScenarioResponse response = new ScenarioResponse();
        response.setScenarioType(type);
        response.setDescription(pythonResult.path("description").asText());

        List<ScenarioResponse.ScenarioPoint> points = new ArrayList<>();
        JsonNode pointsNode = pythonResult.path("points");
        for (JsonNode p : pointsNode) {
            ScenarioResponse.ScenarioPoint point = new ScenarioResponse.ScenarioPoint();
            point.setPeriod(p.path("period").asText());
            point.setValue(p.path("value").asDouble());
            point.setLowerBound(p.path("lowerBound").asDouble());
            point.setUpperBound(p.path("upperBound").asDouble());
            points.add(point);
        }
        response.setPoints(points);
        response.setQualityScore(pythonResult.path("qualityScore").asDouble(0.12));
        return response;
    }

    private String[] getFutureMonths(int count) {
        String[] months = new String[count];
        Calendar cal = Calendar.getInstance();
        for (int i = 0; i < count; i++) {
            cal.add(Calendar.MONTH, 1);
            months[i] = String.format("%d-%02d", cal.get(Calendar.YEAR), cal.get(Calendar.MONTH) + 1);
        }
        return months;
    }

    private List<ScenarioResponse> createFallbackScenarios(String subject, String indicator) {
        List<ScenarioResponse> fallback = new ArrayList<>();
        List<ScenarioResponse.ScenarioPoint> points = new ArrayList<>();
        String[] months = getFutureMonths(6);
        double base = 1000;
        for (int i = 0; i < months.length; i++) {
            double value = base * (1 + i * 0.02);
            points.add(new ScenarioResponse.ScenarioPoint(months[i], value, value * 0.85, value * 1.15));
        }
        fallback.add(new ScenarioResponse("BASELINE", "Заглушка для " + indicator + " в " + subject, points, 0.12));
        return fallback;
    }
}
package com.example.universityanalytics.service;

import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.FactRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class ForecastService {

    private final FactRepository factRepository;
    private final PythonClientService pythonClientService;

    public ForecastService(FactRepository factRepository, PythonClientService pythonClientService) {
        this.factRepository = factRepository;
        this.pythonClientService = pythonClientService;
    }

    public Map<String, Object> generateForecast(String subject, String indicator, int horizon, String method) {
        List<FactEntity> facts = factRepository.findBySubject(subject);
        Map<Integer, Map<Integer, Double>> history = buildHistory(facts, indicator);

        if (history.isEmpty()) {
            Map<String, Object> empty = new LinkedHashMap<>();
            empty.put("error", "Нет данных для прогноза");
            return empty;
        }

        JsonNode result = pythonClientService.callPredict(subject, indicator, horizon, method, history);
        if (result != null) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("method", method);
            response.put("indicator", indicator);
            response.put("subject", subject);
            response.put("points", result.path("points"));
            response.put("qualityScore", result.path("qualityScore").asDouble(0.12));
            return response;
        } else {
            Map<String, Object> fallback = new LinkedHashMap<>();
            fallback.put("method", method);
            fallback.put("indicator", indicator);
            fallback.put("subject", subject);
            fallback.put("fallback", true);
            fallback.put("forecast", new HashMap<>());
            return fallback;
        }
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
}
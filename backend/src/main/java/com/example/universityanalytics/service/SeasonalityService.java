package com.example.universityanalytics.service;

import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.FactRepository;
import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class SeasonalityService {

    private final FactRepository factRepository;

    public SeasonalityService(FactRepository factRepository) {
        this.factRepository = factRepository;
    }

    public Map<Integer, Double> calculateSeasonality(String subject, String indicator) {
        List<FactEntity> facts = factRepository.findBySubject(subject);
        if (facts.isEmpty()) {
            return getDefaultSeasonality();
        }

        // Группируем по году и месяцу для указанного индикатора
        Map<Integer, Map<Integer, Double>> yearlyData = new HashMap<>();
        for (FactEntity fact : facts) {
            if (!fact.getIndicator().equals(indicator)) continue;
            String[] parts = fact.getPeriod().split("-");
            int year = Integer.parseInt(parts[0]);
            int month = Integer.parseInt(parts[1]);
            yearlyData.computeIfAbsent(year, k -> new HashMap<>()).put(month, fact.getValue());
        }

        if (yearlyData.isEmpty()) {
            return getDefaultSeasonality();
        }

        // Считаем среднее для каждого месяца
        Map<Integer, Double> monthlyAvg = new HashMap<>();
        Map<Integer, Integer> monthlyCount = new HashMap<>();
        for (Map<Integer, Double> months : yearlyData.values()) {
            for (Map.Entry<Integer, Double> entry : months.entrySet()) {
                int month = entry.getKey();
                double value = entry.getValue();
                monthlyAvg.put(month, monthlyAvg.getOrDefault(month, 0.0) + value);
                monthlyCount.put(month, monthlyCount.getOrDefault(month, 0) + 1);
            }
        }

        for (int month : monthlyAvg.keySet()) {
            monthlyAvg.put(month, monthlyAvg.get(month) / monthlyCount.get(month));
        }

        // Среднегодовое значение
        double totalAvg = monthlyAvg.values().stream().mapToDouble(Double::doubleValue).average().orElse(1.0);

        // Индексы сезонности
        Map<Integer, Double> seasonality = new HashMap<>();
        for (int month = 1; month <= 12; month++) {
            double avg = monthlyAvg.getOrDefault(month, 0.0);
            seasonality.put(month, totalAvg > 0 ? Math.round((avg / totalAvg) * 100.0) / 100.0 : 1.0);
        }
        return seasonality;
    }

    private Map<Integer, Double> getDefaultSeasonality() {
        Map<Integer, Double> defaultSeasonality = new HashMap<>();
        double[] factors = {0.95, 1.02, 1.05, 1.00, 0.95, 0.70, 0.30, 0.30, 1.20, 1.15, 1.10, 1.05};
        for (int i = 0; i < 12; i++) {
            defaultSeasonality.put(i + 1, factors[i]);
        }
        return defaultSeasonality;
    }
}
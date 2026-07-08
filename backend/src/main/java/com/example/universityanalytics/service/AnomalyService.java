package com.example.universityanalytics.service;

import com.example.universityanalytics.dto.AnomalyDto;
import com.example.universityanalytics.entity.AnomalyCorrectionEntity;
import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.AnomalyCorrectionRepository;
import com.example.universityanalytics.repository.FactRepository;
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
public class AnomalyService {

    private static final Logger log = LoggerFactory.getLogger(AnomalyService.class);
    private static final String DEFAULT_USER = "default";

    private final FactRepository factRepository;
    private final AnomalyCorrectionRepository correctionRepository;

    /**
     * Детектирует аномалии по новому алгоритму (IQR с k=2.5) и возвращает список DTO.
     * Не изменяет данные в БД.
     */
    public List<AnomalyDto> detectAnomalies(String subject, String indicator, Double threshold) {
        List<FactEntity> facts = factRepository.findAll();
        if (subject != null && !subject.isEmpty()) {
            facts = facts.stream().filter(f -> f.getSubject().equals(subject)).collect(Collectors.toList());
        }
        if (indicator != null && !indicator.isEmpty()) {
            facts = facts.stream().filter(f -> f.getIndicator().equals(indicator)).collect(Collectors.toList());
        }
        if (facts.isEmpty()) return Collections.emptyList();

        // Группируем по индикатору + субъекту (как в старом коде)
        Map<String, List<FactEntity>> groups = new HashMap<>();
        for (FactEntity f : facts) {
            String key = f.getIndicator() + "|" + f.getSubject();
            groups.computeIfAbsent(key, k -> new ArrayList<>()).add(f);
        }

        double k = threshold != null ? threshold : 2.5;
        List<AnomalyDto> anomalies = new ArrayList<>();

        for (Map.Entry<String, List<FactEntity>> entry : groups.entrySet()) {
            List<FactEntity> group = entry.getValue();
            if (group.size() < 5) continue;

            // Группируем по месяцам
            Map<Integer, List<Double>> monthValues = new HashMap<>();
            for (FactEntity f : group) {
                int month = Integer.parseInt(f.getPeriod().split("-")[1]);
                monthValues.computeIfAbsent(month, m -> new ArrayList<>()).add(f.getValue());
            }

            // Для каждого месяца вычисляем Q1, Q3, IQR, границы
            Map<Integer, Double> lowerBound = new HashMap<>();
            Map<Integer, Double> upperBound = new HashMap<>();
            for (Map.Entry<Integer, List<Double>> mEntry : monthValues.entrySet()) {
                int month = mEntry.getKey();
                List<Double> vals = mEntry.getValue();
                Collections.sort(vals);
                double q1 = percentile(vals, 0.25);
                double q3 = percentile(vals, 0.75);
                double iqr = q3 - q1;
                lowerBound.put(month, q1 - k * iqr);
                upperBound.put(month, q3 + k * iqr);
            }

            // Проверяем каждую запись
            for (FactEntity f : group) {
                int month = Integer.parseInt(f.getPeriod().split("-")[1]);
                Double low = lowerBound.get(month);
                Double high = upperBound.get(month);
                if (low == null || high == null) continue;
                if (f.getValue() < low || f.getValue() > high) {
                    AnomalyDto dto = new AnomalyDto();
                    dto.setId(f.getSubject() + "-" + f.getIndicator() + "-" + f.getPeriod());
                    dto.setPeriod(f.getPeriod());
                    dto.setIndicator(f.getIndicator());
                    dto.setSubject(f.getSubject());
                    double mean = monthValues.get(month).stream().mapToDouble(v -> v).average().orElse(0);
                    double deviation = mean != 0 ? ((f.getValue() - mean) / mean) * 100 : 0;
                    dto.setDeviationPct(deviation);
                    dto.setDirection(f.getValue() > mean ? "up" : "down");
                    dto.setText(String.format("%s: %s в %s %s на %.1f%% от нормы",
                            f.getPeriod(), f.getIndicator(), f.getSubject(),
                            f.getValue() > mean ? "вырос" : "снизился", Math.abs(deviation)));
                    anomalies.add(dto);
                }
            }
        }
        return anomalies;
    }

    private double percentile(List<Double> sorted, double p) {
        int n = sorted.size();
        double index = p * (n - 1);
        int low = (int) Math.floor(index);
        int high = (int) Math.ceil(index);
        if (low == high) return sorted.get(low);
        double frac = index - low;
        return sorted.get(low) * (1 - frac) + sorted.get(high) * frac;
    }

    /**
     * Заменяет аномалии на очищенные значения (медиана по месяцу) и сохраняет оригиналы.
     * Возвращает количество заменённых записей.
     */
    @Transactional
    public int replaceAnomalies(String subject, String indicator, Double threshold, String userId) {
        if (userId == null) userId = DEFAULT_USER;

        // Проверяем, есть ли уже активные коррекции для этого пользователя
        if (correctionRepository.existsByUserId(userId)) {
            throw new IllegalStateException("Аномалии уже были заменены. Сначала восстановите исходные данные.");
        }

        // Получаем все факты
        List<FactEntity> allFacts = factRepository.findAll();
        if (subject != null && !subject.isEmpty()) {
            allFacts = allFacts.stream().filter(f -> f.getSubject().equals(subject)).collect(Collectors.toList());
        }
        if (indicator != null && !indicator.isEmpty()) {
            allFacts = allFacts.stream().filter(f -> f.getIndicator().equals(indicator)).collect(Collectors.toList());
        }
        if (allFacts.isEmpty()) return 0;

        // Группируем по (индикатор, субъект) для вычисления медиан по месяцам
        Map<String, List<FactEntity>> groups = allFacts.stream()
                .collect(Collectors.groupingBy(f -> f.getIndicator() + "|" + f.getSubject()));

        double k = threshold != null ? threshold : 2.5;
        List<AnomalyCorrectionEntity> corrections = new ArrayList<>();
        List<FactEntity> toUpdate = new ArrayList<>();

        for (Map.Entry<String, List<FactEntity>> entry : groups.entrySet()) {
            List<FactEntity> group = entry.getValue();
            if (group.size() < 5) continue;

            // Собираем значения по месяцам для вычисления медиан (чистых)
            Map<Integer, List<Double>> monthValues = new HashMap<>();
            for (FactEntity f : group) {
                int month = Integer.parseInt(f.getPeriod().split("-")[1]);
                monthValues.computeIfAbsent(month, m -> new ArrayList<>()).add(f.getValue());
            }

            // Вычисляем границы IQR для каждого месяца
            Map<Integer, Double> lowerBound = new HashMap<>();
            Map<Integer, Double> upperBound = new HashMap<>();
            for (Map.Entry<Integer, List<Double>> mEntry : monthValues.entrySet()) {
                int month = mEntry.getKey();
                List<Double> vals = mEntry.getValue();
                Collections.sort(vals);
                double q1 = percentile(vals, 0.25);
                double q3 = percentile(vals, 0.75);
                double iqr = q3 - q1;
                lowerBound.put(month, q1 - k * iqr);
                upperBound.put(month, q3 + k * iqr);
            }

            // Вычисляем чистую медиану (без аномалий) для каждого месяца
            // Сначала определяем аномалии
            Map<Long, Boolean> anomalyMap = new HashMap<>();
            for (FactEntity f : group) {
                int month = Integer.parseInt(f.getPeriod().split("-")[1]);
                Double low = lowerBound.get(month);
                Double high = upperBound.get(month);
                if (low != null && high != null) {
                    boolean isAnomaly = f.getValue() < low || f.getValue() > high;
                    anomalyMap.put(f.getId(), isAnomaly);
                } else {
                    anomalyMap.put(f.getId(), false);
                }
            }

            // Вычисляем медиану по месяцам, исключая аномалии
            Map<Integer, Double> cleanMedian = new HashMap<>();
            for (int month : monthValues.keySet()) {
                List<Double> cleanVals = new ArrayList<>();
                for (FactEntity f : group) {
                    if (Integer.parseInt(f.getPeriod().split("-")[1]) == month) {
                        if (!anomalyMap.getOrDefault(f.getId(), false)) {
                            cleanVals.add(f.getValue());
                        }
                    }
                }
                if (!cleanVals.isEmpty()) {
                    Collections.sort(cleanVals);
                    double median = cleanVals.size() % 2 == 0 ?
                            (cleanVals.get(cleanVals.size()/2 - 1) + cleanVals.get(cleanVals.size()/2)) / 2.0 :
                            cleanVals.get(cleanVals.size()/2);
                    cleanMedian.put(month, median);
                } else {
                    // Если все значения аномальны, используем общую медиану всех значений
                    List<Double> allVals = monthValues.get(month);
                    Collections.sort(allVals);
                    double median = allVals.size() % 2 == 0 ?
                            (allVals.get(allVals.size()/2 - 1) + allVals.get(allVals.size()/2)) / 2.0 :
                            allVals.get(allVals.size()/2);
                    cleanMedian.put(month, median);
                }
            }

            // Создаём коррекции и обновляем факты
            for (FactEntity f : group) {
                if (anomalyMap.getOrDefault(f.getId(), false)) {
                    int month = Integer.parseInt(f.getPeriod().split("-")[1]);
                    Double cleaned = cleanMedian.get(month);
                    if (cleaned == null) continue;

                    AnomalyCorrectionEntity correction = new AnomalyCorrectionEntity();
                    correction.setFactId(f.getId());
                    correction.setOriginalValue(f.getValue());
                    correction.setCleanedValue(cleaned);
                    correction.setPeriod(f.getPeriod());
                    correction.setSubject(f.getSubject());
                    correction.setIndicator(f.getIndicator());
                    correction.setCreatedAt(LocalDateTime.now());
                    correction.setUserId(userId);
                    corrections.add(correction);

                    // Меняем значение факта на очищенное
                    f.setValue(cleaned);
                    toUpdate.add(f);
                }
            }
        }

        if (corrections.isEmpty()) {
            return 0;
        }

        // Сохраняем коррекции и обновлённые факты
        correctionRepository.saveAll(corrections);
        factRepository.saveAll(toUpdate);

        log.info("Заменено {} аномалий для пользователя {}", corrections.size(), userId);
        return corrections.size();
    }

    /**
     * Восстанавливает исходные данные из коррекций.
     */
    @Transactional
    public int restoreAnomalies(String userId) {
        if (userId == null) userId = DEFAULT_USER;
        List<AnomalyCorrectionEntity> corrections = correctionRepository.findByUserId(userId);
        if (corrections.isEmpty()) return 0;

        // Восстанавливаем значения в фактах
        List<FactEntity> toUpdate = new ArrayList<>();
        for (AnomalyCorrectionEntity corr : corrections) {
            factRepository.findById(corr.getFactId()).ifPresent(fact -> {
                fact.setValue(corr.getOriginalValue());
                toUpdate.add(fact);
            });
        }
        factRepository.saveAll(toUpdate);

        // Удаляем коррекции
        correctionRepository.deleteByUserId(userId);

        log.info("Восстановлено {} аномалий для пользователя {}", corrections.size(), userId);
        return corrections.size();
    }

    /**
     * Проверяет, есть ли активные коррекции для пользователя.
     */
    public boolean hasActiveCorrections(String userId) {
        if (userId == null) userId = DEFAULT_USER;
        return correctionRepository.existsByUserId(userId);
    }

    /**
     * Очищает все коррекции (используется при очистке БД).
     */
    @Transactional
    public void clearAllCorrections() {
        correctionRepository.deleteAll();
    }
}
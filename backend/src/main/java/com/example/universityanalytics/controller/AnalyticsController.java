package com.example.universityanalytics.controller;

import com.example.universityanalytics.dto.ScenarioParams;
import com.example.universityanalytics.dto.ScenarioResponse;
import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.FactRepository;
import com.example.universityanalytics.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AnalyticsController {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsController.class);

    private final FactRepository factRepository;
    private final UploadDataService uploadDataService;
    private final DriversService driversService;
    private final ScenarioService scenarioService;
    private final SeasonalityService seasonalityService;
    private final ForecastService forecastService;
    private final PythonClientService pythonClientService;

    public AnalyticsController(FactRepository factRepository,
                               UploadDataService uploadDataService,
                               DriversService driversService,
                               ScenarioService scenarioService,
                               SeasonalityService seasonalityService,
                               ForecastService forecastService,
                               PythonClientService pythonClientService) {
        this.factRepository = factRepository;
        this.uploadDataService = uploadDataService;
        this.driversService = driversService;
        this.scenarioService = scenarioService;
        this.seasonalityService = seasonalityService;
        this.forecastService = forecastService;
        this.pythonClientService = pythonClientService;
    }

    // ============================================================
    // 1. ФАКТЫ (исторические данные)
    // ============================================================
    @GetMapping("/facts")
    public ResponseEntity<List<FactEntity>> getFacts(@RequestParam(required = false) String subject) {
        if (subject != null && !subject.isEmpty()) {
            return ResponseEntity.ok(factRepository.findBySubject(subject));
        }
        return ResponseEntity.ok(factRepository.findAll());
    }

    // ============================================================
    // 2. СПРАВОЧНИКИ
    // ============================================================
    @GetMapping("/regions")
    public ResponseEntity<List<String>> getRegions() {
        return ResponseEntity.ok(factRepository.findDistinctSubjects());
    }

    @GetMapping("/indicators")
    public ResponseEntity<List<String>> getIndicators() {
        return ResponseEntity.ok(factRepository.findDistinctIndicators());
    }

    // ============================================================
    // 3. ЗАГРУЗКА ФАЙЛА
    // ============================================================
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            uploadDataService.uploadAndUpsert(file);
            Map<String, String> response = new HashMap<>();
            response.put("status", "ok");
            response.put("message", "Данные успешно загружены и пересчитаны.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Ошибка при загрузке файла", e);
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    // ============================================================
    // 4. ДРАЙВЕРЫ (теперь любой показатель!)
    // ============================================================
    @GetMapping("/analytics/drivers")
    public ResponseEntity<List<DriversService.DriverRow>> getDrivers(
            @RequestParam String subject,
            @RequestParam String indicator) {
        return ResponseEntity.ok(driversService.getDrivers(subject, indicator));
    }

    // ============================================================
    // 5. СЕЗОННОСТЬ (любой показатель!)
    // ============================================================
    @GetMapping("/seasonality")
    public ResponseEntity<Map<Integer, Double>> getSeasonality(
            @RequestParam String subject,
            @RequestParam String indicator) {
        return ResponseEntity.ok(seasonalityService.calculateSeasonality(subject, indicator));
    }

    // ============================================================
// 6. ПРОГНОЗ (любой показатель!)
// ============================================================
    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> getForecast(
            @RequestParam String subject,
            @RequestParam String indicator,
            @RequestParam(defaultValue = "6") int horizon,
            @RequestParam(defaultValue = "sarimax") String method) {

        log.info("📊 Прогноз: subject={}, indicator={}, horizon={}, method={}", subject, indicator, horizon, method);

        List<FactEntity> facts = factRepository.findBySubject(subject);
        Map<Integer, Map<Integer, Double>> history = buildHistory(facts, indicator);

        if (history.isEmpty()) {
            log.warn("⚠️ Нет данных для прогноза по {} в {}", indicator, subject);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("error", "Нет данных для прогноза");
            response.put("indicator", indicator);
            response.put("subject", subject);
            return ResponseEntity.ok(response);
        }

        log.info("📊 История: {} лет", history.size());
        for (Map.Entry<Integer, Map<Integer, Double>> entry : history.entrySet()) {
            log.info("  {}: {} месяцев", entry.getKey(), entry.getValue().size());
        }

        JsonNode pythonResult = pythonClientService.callPredict(subject, indicator, horizon, method, history);

        Map<String, Object> response = new LinkedHashMap<>();
        if (pythonResult != null) {
            log.info("✅ Python вернул результат");

            response.put("method", method);
            response.put("indicator", indicator);
            response.put("subject", subject);

            // Извлекаем прогноз
            if (pythonResult.has("forecast")) {
                response.put("points", pythonResult.path("forecast"));
            } else if (pythonResult.has("metrics")) {
                response.put("metrics", pythonResult.path("metrics"));
                response.put("points", pythonResult.path("forecast"));
            } else {
                response.put("raw", pythonResult);
            }

            if (pythonResult.has("metrics") && pythonResult.path("metrics").has("RMSE")) {
                response.put("qualityScore", pythonResult.path("metrics").path("RMSE").asDouble(0.12));
            } else {
                response.put("qualityScore", 0.12);
            }

            log.info("📤 Ответ: {}", response);
        } else {
            log.error("❌ Python-сервис недоступен");
            response.put("error", "Python-сервис недоступен");
            response.put("method", method);
            response.put("indicator", indicator);
            response.put("subject", subject);
        }
        return ResponseEntity.ok(response);
    }

    // ============================================================
// 7. СЦЕНАРИИ (любой показатель!)
// ============================================================
    @GetMapping("/scenarios")
    public ResponseEntity<List<ScenarioResponse>> getScenarios(
            @RequestParam String subject,
            @RequestParam String indicator,
            @RequestParam(defaultValue = "6") int horizon) {

        log.info("📊 Сценарии: subject={}, indicator={}, horizon={}", subject, indicator, horizon);
        return ResponseEntity.ok(scenarioService.getDefaultScenarios(subject, indicator, horizon));
    }

    @PostMapping("/scenarios/compute")
    public ResponseEntity<ScenarioResponse> computeScenario(@RequestBody ScenarioParams params) {
        ScenarioResponse response = scenarioService.computeCustomScenario(
                params.getTargetSubject(),
                params.getTargetIndicator(),
                params.getHorizonMonths(),
                params.getMethod(),
                params.getDriverMultipliers()
        );
        return ResponseEntity.ok(response);
    }

    // ============================================================
    // 8. AI-АНАЛИТИКА
    // ============================================================
    // ============================================================
// 8. AI-АНАЛИТИКА (теперь POST!)
// ============================================================

    // ============================================================
// 8. AI-АНАЛИТИКА (динамические показатели!)
// ============================================================

    // AnalyticsController.java — исправленный /news
    @PostMapping("/news")
    public ResponseEntity<List<Map<String, Object>>> getNews(@RequestBody Map<String, Object> request) {
        String subject = (String) request.getOrDefault("subject", "");
        int period = request.containsKey("period") ? (int) request.get("period") : 90;

        List<String> indicators = factRepository.findDistinctIndicators();

        Map<String, Object> data = new HashMap<>();
        data.put("subject", subject);
        data.put("period", period);
        data.put("indicators", indicators);

        JsonNode result = pythonClientService.callGenerateNews(data);
        List<Map<String, Object>> news = new ArrayList<>();

        if (result != null && result.has("news")) {
            JsonNode newsNode = result.path("news");
            for (JsonNode item : newsNode) {
                Map<String, Object> newsItem = new HashMap<>();
                newsItem.put("title", item.path("title").asText("Новость"));
                newsItem.put("summary", item.path("summary").asText());
                newsItem.put("source", item.path("source").asText("Источник"));
                newsItem.put("date", item.path("date").asText(""));
                newsItem.put("url", item.path("url").asText(""));
                // ✅ Если impact нет — ставим "neutral" по умолчанию
                newsItem.put("impact", item.path("impact").asText("neutral"));
                news.add(newsItem);
            }
        } else {
            news.add(Map.of(
                    "title", "Новости по региону " + subject,
                    "summary", "Новости временно недоступны.",
                    "source", "Система",
                    "date", java.time.LocalDate.now().toString(),
                    "url", "",
                    "impact", "neutral"
            ));
        }
        return ResponseEntity.ok(news);
    }

    @PostMapping("/ai/summary")
    public ResponseEntity<Map<String, String>> getAiSummary(@RequestBody Map<String, String> request) {
        String subject = request.get("subject");
        if (subject == null || subject.isEmpty()) {
            Map<String, String> error = new HashMap<>();
            error.put("summary", "Ошибка: не указан регион");
            return ResponseEntity.badRequest().body(error);
        }

        // ✅ Тоже передаём показатели для контекста
        List<String> indicators = factRepository.findDistinctIndicators();

        List<FactEntity> facts = factRepository.findBySubject(subject);
        Map<String, Object> data = new HashMap<>();
        data.put("subject", subject);
        data.put("records", facts.size());
        data.put("indicators", indicators);

        JsonNode result = pythonClientService.callGenerateText(data);
        Map<String, String> response = new HashMap<>();
        if (result != null && result.has("summary")) {
            response.put("summary", result.path("summary").asText());
        } else {
            response.put("summary", "Аналитика временно недоступна.");
        }
        return ResponseEntity.ok(response);
    }

    // ============================================================
    // 9. АНОМАЛИИ
    // ============================================================
    @GetMapping("/anomalies")
    public ResponseEntity<List<Map<String, Object>>> getAnomalies(
            @RequestParam String subject,
            @RequestParam String indicator) {  // ← теперь indicator обязательный!

        List<FactEntity> facts = factRepository.findBySubject(subject);
        if (facts.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        Map<Integer, Map<Integer, Double>> history = buildHistory(facts, indicator);
        List<Map<String, Object>> anomalies = new ArrayList<>();

        List<Double> allValues = new ArrayList<>();
        for (Map<Integer, Double> months : history.values()) {
            allValues.addAll(months.values());
        }

        if (allValues.size() > 5) {
            double mean = allValues.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            double std = Math.sqrt(allValues.stream().mapToDouble(v -> Math.pow(v - mean, 2)).average().orElse(0));

            for (Map.Entry<Integer, Map<Integer, Double>> yearEntry : history.entrySet()) {
                int year = yearEntry.getKey();
                for (Map.Entry<Integer, Double> monthEntry : yearEntry.getValue().entrySet()) {
                    int month = monthEntry.getKey();
                    double value = monthEntry.getValue();
                    if (Math.abs(value - mean) > 2 * std) {
                        Map<String, Object> anomaly = new LinkedHashMap<>();
                        anomaly.put("period", year + "-" + String.format("%02d", month));
                        anomaly.put("indicator", indicator);
                        anomaly.put("subject", subject);
                        anomaly.put("deviationPct", Math.round((value - mean) / mean * 100));
                        anomaly.put("direction", value > mean ? "up" : "down");
                        anomaly.put("text", String.format("%d-%02d: %s в %s %s на %.1f%% от среднего",
                                year, month, indicator, subject, value > mean ? "вырос" : "снизился",
                                Math.abs((value - mean) / mean * 100)));
                        anomalies.add(anomaly);
                    }
                }
            }
        }
        return ResponseEntity.ok(anomalies);
    }

    // ============================================================
    // 10. ЭКСПОРТ В CSV
    // ============================================================
    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportToCsv(@RequestParam(required = false) String subject) throws IOException {
        log.info("Экспорт в CSV для региона: {}", subject != null ? subject : "все регионы");

        List<FactEntity> data;
        if (subject != null && !subject.isEmpty()) {
            data = factRepository.findBySubject(subject);
        } else {
            data = factRepository.findAll();
        }

        StringBuilder csv = new StringBuilder();
        csv.append("\uFEFF");
        csv.append("Период;Округ;Субъект;Показатель;Ед.изм.;Значение\n");

        for (FactEntity e : data) {
            csv.append(String.format("%s;%s;%s;%s;%s;%.2f\n",
                    e.getPeriod(),
                    e.getDistrict() != null ? e.getDistrict() : "",
                    e.getSubject(),
                    e.getIndicator(),
                    e.getUnit() != null ? e.getUnit() : "",
                    e.getValue()
            ));
        }

        byte[] content = csv.toString().getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", "analytics_export.csv");
        return ResponseEntity.ok()
                .headers(headers)
                .body(content);
    }

    // ============================================================
    // ВСПОМОГАТЕЛЬНЫЙ МЕТОД
    // ============================================================
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
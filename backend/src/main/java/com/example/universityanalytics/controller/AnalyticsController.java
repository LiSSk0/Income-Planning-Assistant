package com.example.universityanalytics.controller;

import com.example.universityanalytics.dto.*;
import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.FactRepository;
import com.example.universityanalytics.service.*;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class AnalyticsController {

    private static final Logger log = LoggerFactory.getLogger(AnalyticsController.class);

    private final FactRepository factRepository;
    private final UploadDataService uploadDataService;
    private final DriversService driversService;
    private final ScenarioService scenarioService;
    private final SeasonalityService seasonalityService;
    private final ForecastService forecastService;
    private final PythonClientService pythonClientService;
    private final GraphService graphService;
    private final AnomalyService anomalyService;
    private final NewsService newsService;

    // ========== Факты и справочники ==========
    @GetMapping("/facts")
    public ResponseEntity<List<FactDto>> getFacts(@RequestParam(required = false) String subject) {
        List<FactEntity> facts = (subject != null && !subject.isEmpty())
                ? factRepository.findBySubject(subject)
                : factRepository.findAll();
        return ResponseEntity.ok(facts.stream().map(this::toFactDto).toList());
    }

    @GetMapping("/regions")
    public ResponseEntity<List<String>> getRegions() {
        return ResponseEntity.ok(factRepository.findDistinctSubjects());
    }

    @GetMapping("/indicators")
    public ResponseEntity<List<String>> getIndicators() {
        return ResponseEntity.ok(factRepository.findDistinctIndicators());
    }

    // ========== Загрузка ==========
    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            uploadDataService.uploadAndUpsert(file);
            return ResponseEntity.ok(Map.of("status", "ok", "message", "Данные успешно загружены и пересчитаны."));
        } catch (Exception e) {
            log.error("Ошибка загрузки", e);
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/analytics/upload")
    public ResponseEntity<Map<String, String>> uploadFileAlt(@RequestParam("file") MultipartFile file) {
        return uploadFile(file);
    }

    @GetMapping("/entities")
    public ResponseEntity<List<DetectedEntityDto>> getEntities() {
        List<DetectedEntityDto> result = new ArrayList<>();
        List<FactEntity> facts = factRepository.findAll();
        if (facts.isEmpty()) return ResponseEntity.ok(result);

        List<String> periods = factRepository.findAllPeriods().stream().limit(3).toList();
        List<String> districts = factRepository.findDistinctSubjects().stream().limit(3).toList();
        List<String> indicators = factRepository.findDistinctIndicators().stream().limit(3).toList();

        result.add(new DetectedEntityDto("period", "date", 0.99, periods));
        result.add(new DetectedEntityDto("district", "territory", 0.97, districts));
        result.add(new DetectedEntityDto("subject", "territory", 0.96, districts));
        result.add(new DetectedEntityDto("indicator", "indicator", 0.94, indicators));
        result.add(new DetectedEntityDto("unit", "unit", 0.90, List.of("руб", "чел", "%")));
        result.add(new DetectedEntityDto("value", "value", 0.98,
                facts.stream().limit(3).map(f -> String.valueOf(f.getValue())).toList()));

        return ResponseEntity.ok(result);
    }

    // ========== Граф ==========
    @GetMapping("/graph")
    public ResponseEntity<BusinessGraphDto> getGraph() {
        return ResponseEntity.ok(graphService.getGraph());
    }

    @PostMapping("/graph/formulas")
    public ResponseEntity<SaveFormulasResponseDto> saveGraphFormulas(@RequestBody SaveFormulasRequestDto request) {
        BusinessGraphDto graph = new BusinessGraphDto();
        graph.setNodes(request.getNodes());
        graph.setEdges(request.getEdges());
        graphService.saveGraph(graph);
        SaveFormulasResponseDto response = new SaveFormulasResponseDto();
        response.setStatus("ok");
        response.setSaved(request.getFormulas().size());
        return ResponseEntity.ok(response);
    }

    // ========== Сценарии ==========
    @GetMapping("/scenarios")
    public ResponseEntity<List<ScenarioDto>> getScenarios() {
        return ResponseEntity.ok(scenarioService.getScenarios());
    }

    @PostMapping("/scenarios")
    public ResponseEntity<ScenarioDto> createScenario(@RequestBody ScenarioParamsDto params,
                                                      @RequestParam(required = false) String userId) {
        return ResponseEntity.ok(scenarioService.generateScenario(params, userId));
    }

    @PostMapping("/scenarios/compute")
    public ResponseEntity<ScenarioDto> computeScenario(@RequestBody ScenarioParamsDto params,
                                                       @RequestParam(required = false) String userId) {
        return createScenario(params, userId);
    }

    @DeleteMapping("/scenarios/{id}")
    public ResponseEntity<Map<String, String>> deleteScenario(@PathVariable String id) {
        scenarioService.deleteScenario(id);
        return ResponseEntity.ok(Map.of("status", "ok", "message", "Сценарий удалён"));
    }

    // ========== Аномалии ==========
    @GetMapping("/anomalies")
    public ResponseEntity<List<AnomalyDto>> getAnomalies(
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String indicator,
            @RequestParam(required = false) Double threshold) {
        return ResponseEntity.ok(anomalyService.detectAnomalies(subject, indicator, threshold));
    }

    @GetMapping("/anomalies/status")
    public ResponseEntity<Map<String, Boolean>> getAnomalyStatus(@RequestParam(required = false) String userId) {
        String uid = userId != null ? userId : "default";
        boolean active = anomalyService.hasActiveCorrections(uid);
        return ResponseEntity.ok(Map.of("active", active));
    }

    @PostMapping("/anomalies/replace")
    public ResponseEntity<Map<String, Object>> replaceAnomalies(
            @RequestParam(required = false) String subject,
            @RequestParam(required = false) String indicator,
            @RequestParam(defaultValue = "2.5") Double threshold,
            @RequestParam(required = false) String userId) {
        String uid = userId != null ? userId : "default";
        int count = anomalyService.replaceAnomalies(subject, indicator, threshold, uid);
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "replaced", count,
                "message", count + " аномалий заменены"
        ));
    }

    @PostMapping("/anomalies/restore")
    public ResponseEntity<Map<String, Object>> restoreAnomalies(@RequestParam(required = false) String userId) {
        String uid = userId != null ? userId : "default";
        int count = anomalyService.restoreAnomalies(uid);
        return ResponseEntity.ok(Map.of(
                "status", "ok",
                "restored", count,
                "message", count + " аномалий восстановлены"
        ));
    }

    // ========== Новости ==========
    @GetMapping("/news")
    public ResponseEntity<List<NewsDto>> getNewsGet(
            @RequestParam(required = false) String subject,
            @RequestParam(defaultValue = "90") int period) {
        return ResponseEntity.ok(newsService.getNews(subject, period));
    }

    @PostMapping("/news")
    public ResponseEntity<List<NewsDto>> postNews(@RequestBody Map<String, Object> request) {
        String subject = (String) request.getOrDefault("subject", "");
        int period = request.containsKey("period") ? (int) request.get("period") : 90;
        return ResponseEntity.ok(newsService.getNews(subject, period));
    }

    // ========== AI-аналитика ==========
    @PostMapping("/ai/summary")
    public ResponseEntity<Map<String, String>> getAiSummary(@RequestBody Map<String, String> request) {
        String subject = request.get("subject");
        if (subject == null || subject.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("summary", "Не указан регион"));
        }
        List<String> indicators = factRepository.findDistinctIndicators();
        List<FactEntity> facts = factRepository.findBySubject(subject);
        Map<String, Object> data = new HashMap<>();
        data.put("subject", subject);
        data.put("records", facts.size());
        data.put("indicators", indicators);

        JsonNode result = pythonClientService.callGenerateText(data);
        if (result != null && result.has("summary")) {
            return ResponseEntity.ok(Map.of("summary", result.path("summary").asText()));
        }
        return ResponseEntity.ok(Map.of("summary", "Аналитика временно недоступна."));
    }

    // ========== Драйверы ==========
    @GetMapping("/analytics/drivers")
    public ResponseEntity<List<DriversService.DriverRow>> getDrivers(
            @RequestParam String subject,
            @RequestParam String indicator) {
        return ResponseEntity.ok(driversService.getDrivers(subject, indicator));
    }

    @GetMapping("/scenarios/{id}/drivers")
    public ResponseEntity<Map<String, Double>> getScenarioDrivers(
            @PathVariable String id,
            @RequestParam String region) {
        try {
            Map<String, Double> drivers = scenarioService.calculateDrivers(id, region);
            return ResponseEntity.ok(drivers);
        } catch (Exception e) {
            log.error("Ошибка расчёта драйверов для сценария {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // ========== Сезонность ==========
    @GetMapping("/seasonality")
    public ResponseEntity<Map<Integer, Double>> getSeasonality(
            @RequestParam String subject,
            @RequestParam String indicator) {
        return ResponseEntity.ok(seasonalityService.calculateSeasonality(subject, indicator));
    }

    // ========== Прогноз ==========
    @GetMapping("/forecast")
    public ResponseEntity<Map<String, Object>> getForecast(
            @RequestParam String subject,
            @RequestParam String indicator,
            @RequestParam(defaultValue = "6") int horizon,
            @RequestParam(defaultValue = "sarimax") String method) {
        return ResponseEntity.ok(forecastService.generateForecast(subject, indicator, horizon, method));
    }

    // ========== Экспорт ==========
    @GetMapping("/export/csv")
    public ResponseEntity<byte[]> exportToCsv(@RequestParam(required = false) String subject) throws IOException {
        List<FactEntity> data = (subject != null && !subject.isEmpty())
                ? factRepository.findBySubject(subject)
                : factRepository.findAll();

        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append("Период;Округ;Субъект;Показатель;Ед.изм.;Значение\n");
        for (FactEntity e : data) {
            csv.append(String.format("%s;%s;%s;%s;%s;%.2f\n",
                    e.getPeriod(),
                    e.getDistrict() != null ? e.getDistrict() : "",
                    e.getSubject(),
                    e.getIndicator(),
                    e.getUnit() != null ? e.getUnit() : "",
                    e.getValue()));
        }
        byte[] content = csv.toString().getBytes(StandardCharsets.UTF_8);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        headers.setContentDispositionFormData("attachment", "analytics_export.csv");
        return ResponseEntity.ok().headers(headers).body(content);
    }

    // ========== Очистка ==========
    @DeleteMapping("/clean")
    public ResponseEntity<Map<String, String>> cleanDatabase() {
        factRepository.deleteAll();
        graphService.deleteGraph();
        anomalyService.clearAllCorrections();
        return ResponseEntity.ok(Map.of("status", "ok", "message", "База данных очищена"));
    }

    // ========== Вспомогательные ==========
    private FactDto toFactDto(FactEntity e) {
        FactDto dto = new FactDto();
        dto.setPeriod(e.getPeriod());
        dto.setDistrict(e.getDistrict());
        dto.setSubject(e.getSubject());
        dto.setIndicator(e.getIndicator());
        dto.setUnit(e.getUnit());
        dto.setValue(e.getValue());
        return dto;
    }
}
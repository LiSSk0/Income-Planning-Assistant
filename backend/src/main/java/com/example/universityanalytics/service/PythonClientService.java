package com.example.universityanalytics.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Map;

@Service
public class PythonClientService {

    private static final Logger log = LoggerFactory.getLogger(PythonClientService.class);

    @Value("${python.service.url:http://localhost:5000}")
    private String pythonUrl;

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    // Внедряем RestTemplate через конструктор
    public PythonClientService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public JsonNode callPredict(String subject, String indicator, int horizon, String method,
                                Map<Integer, Map<Integer, Double>> history) {
        String url = pythonUrl + "/predict";

        try {
            // Правильный формат для Python
            ObjectNode request = objectMapper.createObjectNode();
            ObjectNode dataNode = objectMapper.createObjectNode();
            ObjectNode indicatorNode = objectMapper.createObjectNode();

            for (Map.Entry<Integer, Map<Integer, Double>> yearEntry : history.entrySet()) {
                int year = yearEntry.getKey();
                ObjectNode monthNode = objectMapper.createObjectNode();
                for (Map.Entry<Integer, Double> monthEntry : yearEntry.getValue().entrySet()) {
                    monthNode.put(String.valueOf(monthEntry.getKey()), monthEntry.getValue());
                }
                indicatorNode.set(String.valueOf(year), monthNode);
            }

            dataNode.set(indicator, indicatorNode);
            request.set("data", dataNode);
            request.put("n_periods", horizon);

            log.info("📤 Отправка запроса в Python: {}", request.toString());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(request.toString(), headers);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            log.info("📥 Ответ от Python: статус {}", response.getStatusCode());

            if (response.getStatusCode() == HttpStatus.OK) {
                JsonNode result = objectMapper.readTree(response.getBody());
                log.info("✅ Python ответ получен");

                JsonNode metricResult = result.path(indicator);
                if (metricResult.has("models")) {
                    JsonNode models = metricResult.path("models");
                    for (JsonNode model : models) {
                        if (model.path("best").asBoolean(false)) {
                            return model;
                        }
                    }
                    if (models.size() > 0) {
                        return models.get(0);
                    }
                }
                return result;
            } else {
                log.error("❌ Python вернул ошибку: {}", response.getStatusCode());
                log.error("Тело ответа: {}", response.getBody());
            }
        } catch (Exception e) {
            log.error("❌ Ошибка при вызове Python: {}", e.getMessage(), e);
        }
        return null;
    }

    public JsonNode callGenerateText(Map<String, Object> data) {
        String url = pythonUrl + "/generate-text";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(data, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK) {
                return objectMapper.readTree(response.getBody());
            }
        } catch (Exception e) {
            log.error("Python generate-text error: {}", e.getMessage());
        }
        return null;
    }

    public JsonNode callGenerateNews(Map<String, Object> data) {
        String url = pythonUrl + "/generate-news";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(data, headers);
            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);
            if (response.getStatusCode() == HttpStatus.OK) {
                return objectMapper.readTree(response.getBody());
            }
        } catch (Exception e) {
            log.error("Python generate-news error: {}", e.getMessage());
        }
        return null;
    }
}
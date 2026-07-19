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

    public PythonClientService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public JsonNode callPredict(String subject, String indicator, int horizon, String method,
                                Map<Integer, Map<Integer, Double>> history) {
        String url = pythonUrl + "/predict";

        try {
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

            if (method != null && !method.isEmpty() && !"best".equals(method) && !"all".equals(method)) {
                request.put("method", method);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<String> entity = new HttpEntity<>(request.toString(), headers);

            long start = System.currentTimeMillis();
            log.info("Отправка запроса в Python для '{}' (регион: {})", indicator, subject);

            ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, entity, String.class);

            log.info("Python ответ для '{}' за {} мс, статус {}", indicator, System.currentTimeMillis() - start, response.getStatusCode());

            if (response.getStatusCode() == HttpStatus.OK) {
                String body = response.getBody();
                log.info("ПОЛНЫЙ ОТВЕТ PYTHON ДЛЯ {}: {}", indicator, body);

                JsonNode root = objectMapper.readTree(body);

                // Ищем models:
                // 1. Сначала по имени индикатора: root.get(indicator).get("models")
                // 2. Потом на верхнем уровне: root.get("models")
                JsonNode modelsNode = null;
                if (root.has(indicator) && root.path(indicator).has("models")) {
                    modelsNode = root.path(indicator).path("models");
                    log.info("Найдены models по индикатору '{}'", indicator);
                } else if (root.has("models")) {
                    modelsNode = root.path("models");
                    log.info("Найдены models на верхнем уровне");
                }

                if (modelsNode != null && modelsNode.isArray() && modelsNode.size() > 0) {
                    ObjectNode result = objectMapper.createObjectNode();
                    result.set("models", modelsNode);
                    log.info("Получено {} моделей для '{}'", modelsNode.size(), indicator);
                    return result;
                } else {
                    log.warn("НЕ НАЙДЕНЫ MODELS для '{}' в ответе. ПОЛНЫЙ ОТВЕТ: {}", indicator, body);
                    return null;
                }
            } else {
                log.error("Python вернул ошибку: {}", response.getStatusCode());
                return null;
            }
        } catch (Exception e) {
            log.error("Ошибка при вызове Python: {}", e.getMessage(), e);
            return null;
        }
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
package com.example.universityanalytics.service;

import com.example.universityanalytics.dto.NewsDto;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class NewsService {
    private static final Logger log = LoggerFactory.getLogger(NewsService.class);
    private final PythonClientService pythonClientService;

    private final Map<String, CachedNews> cache = new ConcurrentHashMap<>();
    private static final long TTL_MS = 2 * 60_000; // 2 минуты

    public NewsService(PythonClientService pythonClientService) {
        this.pythonClientService = pythonClientService;
    }

    public List<NewsDto> getNews(String subject, int period) {
        String key = (subject != null ? subject : "null") + "|" + period;

        CachedNews cached = cache.get(key);
        if (cached != null && System.currentTimeMillis() - cached.timestamp < TTL_MS) {
            log.debug("Возвращаем новости из кеша для ключа {}", key);
            return cached.news;
        }

        log.info("Запрашиваем новости у Python для subject={}, period={}", subject, period);

        Map<String, Object> request = new HashMap<>();
        request.put("subject", subject != null ? subject : "");
        request.put("period", period);

        List<NewsDto> news = new ArrayList<>();

        try {
            JsonNode result = pythonClientService.callGenerateNews(request);

            if (result != null && result.has("news")) {
                for (JsonNode item : result.path("news")) {
                    NewsDto dto = new NewsDto();
                    dto.setId(UUID.randomUUID().toString());
                    dto.setTitle(item.path("title").asText("Новость"));
                    dto.setSummary(item.path("summary").asText());
                    dto.setSource(item.path("source").asText("Источник"));
                    dto.setDate(item.path("date").asText(""));
                    dto.setUrl(item.path("url").asText(""));
                    dto.setImpact(item.path("impact").asText("neutral"));
                    dto.setPresumed(true);
                    dto.setRelatedPeriod(Instant.now().toString().substring(0, 7));
                    news.add(dto);
                }
            } else {
                news.add(createFallbackNews(subject));
            }
        } catch (Exception e) {
            log.error("Ошибка при получении новостей из Python: {}", e.getMessage());
            news.add(createFallbackNews(subject));
        }

        cache.put(key, new CachedNews(news, System.currentTimeMillis()));
        return news;
    }

    private NewsDto createFallbackNews(String subject) {
        NewsDto fallback = new NewsDto();
        fallback.setId(UUID.randomUUID().toString());
        fallback.setTitle("Новости по региону " + (subject != null ? subject : "РФ"));
        fallback.setSummary("Новости временно недоступны. Пожалуйста, попробуйте позже.");
        fallback.setSource("Система");
        fallback.setDate(Instant.now().toString().substring(0, 7));
        fallback.setUrl("");
        fallback.setImpact("neutral");
        fallback.setPresumed(false);
        fallback.setRelatedPeriod(Instant.now().toString().substring(0, 7));
        return fallback;
    }

    private static class CachedNews {
        final List<NewsDto> news;
        final long timestamp;

        CachedNews(List<NewsDto> news, long timestamp) {
            this.news = news;
            this.timestamp = timestamp;
        }
    }
}
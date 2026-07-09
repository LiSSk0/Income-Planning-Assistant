package com.example.universityanalytics.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ScenarioDto {
    private String id;
    private String kind;
    private String title;
    private String description;
    private ScenarioParamsDto params;
    private String status;
    private String targetIndicator;
    private List<String> regions;
    private Map<String, List<ModelForecastDto>> regionForecasts;
    private Double growthRateStd;
    private List<ScenarioDriverDto> drivers;
    private List<ScenarioPointDto> series;
    private Map<String, List<ScenarioPointDto>> seriesByIndicator;
    private List<ScenarioRegionValueDto> byRegion;

    // Новые поля
    private Map<String, Double> stdDevByRegion;
    private Map<String, ScenarioStdDevDto> stdDevDetails;
    private Map<String, List<ScenarioPointDto>> historyByRegion;
}
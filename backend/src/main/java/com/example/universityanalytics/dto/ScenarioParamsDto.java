package com.example.universityanalytics.dto;

import lombok.Data;
import java.util.*;

@Data
public class ScenarioParamsDto {
    private String name;
    private String targetIndicator;
    private List<String> regions;          // null или пустой список = все регионы
    private Integer horizonMonths;         // количество месяцев вперёд от последнего известного
    private Boolean useFormulas = true;    // устарело, используем useDirectForecast
    private Boolean useDirectForecast = false; // true = прямой прогноз даже для производных
    private String method;
    private Boolean seasonality;
    private Map<String, Double> driverMultipliers;
    private String forecastMode = "best";
}
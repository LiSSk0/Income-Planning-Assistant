package com.example.universityanalytics.dto;

import lombok.Data;

@Data
public class ForecastVsHistoryDto {
    private String period;
    private Double realValue;
    private Double forecastValue;
    private Double lowerBound;
    private Double upperBound;
}
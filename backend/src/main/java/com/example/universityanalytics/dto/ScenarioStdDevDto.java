package com.example.universityanalytics.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ScenarioStdDevDto {
    private Double stdDev;
    private Map<String, Double> lowerBounds;  // период -> нижняя граница
    private Map<String, Double> upperBounds;  // период -> верхняя граница
}
package com.example.universityanalytics.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ScenarioDriverDto {
    private String indicator;
    private Double contributionPct;
    private Double value;
    private String unit;
}
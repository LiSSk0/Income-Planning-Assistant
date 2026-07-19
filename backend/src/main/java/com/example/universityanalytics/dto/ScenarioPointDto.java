package com.example.universityanalytics.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class ScenarioPointDto {
    private String period;
    private Double value;
    public ScenarioPointDto() {}
    public ScenarioPointDto(String period, Double value) {
        this.period = period;
        this.value = value;
    }
}
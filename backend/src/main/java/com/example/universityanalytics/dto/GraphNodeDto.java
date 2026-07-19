package com.example.universityanalytics.dto;

import lombok.Data;

@Data
public class GraphNodeDto {
    private String id;
    private String indicator;
    private String unit;
    private Double currentValue;
    private Boolean isDerived;
    private Double positionX;
    private Double positionY;
    private String kind;
}
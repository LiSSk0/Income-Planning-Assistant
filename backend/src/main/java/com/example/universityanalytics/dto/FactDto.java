package com.example.universityanalytics.dto;

import lombok.Data;

@Data
public class FactDto {
    private String period;
    private String district;
    private String subject;
    private String indicator;
    private String unit;
    private Double value;
}
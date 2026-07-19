package com.example.universityanalytics.dto;

import lombok.Data;

@Data
public class AnomalyDto {
    private String id;
    private String indicator;
    private String period;
    private String subject;
    private Double deviationPct;
    private String direction;
    private String text;
}
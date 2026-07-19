package com.example.universityanalytics.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;

@Data
@AllArgsConstructor
public class DetectedEntityDto {
    private String column;
    private String category;
    private Double confidence;
    private List<String> sample;
}
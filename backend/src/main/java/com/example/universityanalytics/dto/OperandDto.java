package com.example.universityanalytics.dto;

import lombok.Data;
import lombok.AllArgsConstructor;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class OperandDto {
    private String sourceId;
    private String source;
    private String operator;
}
package com.example.universityanalytics.dto;

import lombok.Data;
import java.util.List;

@Data
public class GraphFormulaDto {
    private String targetId;
    private String target;
    private String expression;
    private List<OperandDto> operands;
}
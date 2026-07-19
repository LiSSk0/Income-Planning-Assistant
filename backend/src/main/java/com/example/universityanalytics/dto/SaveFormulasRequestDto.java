package com.example.universityanalytics.dto;

import lombok.Data;
import java.util.List;

@Data
public class SaveFormulasRequestDto {
    private List<GraphFormulaDto> formulas;
    private List<GraphNodeDto> nodes;
    private List<GraphEdgeDto> edges;
}
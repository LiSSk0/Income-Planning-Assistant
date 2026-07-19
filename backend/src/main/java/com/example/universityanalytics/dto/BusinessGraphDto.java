package com.example.universityanalytics.dto;

import lombok.Data;

import java.util.List;

@Data
public class BusinessGraphDto {
    private List<GraphNodeDto> nodes;
    private List<GraphEdgeDto> edges;
}
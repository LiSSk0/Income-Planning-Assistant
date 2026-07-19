package com.example.universityanalytics.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "graph_nodes")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GraphNodeEntity {
    @Id
    private String id;
    private String indicator;
    private String unit;
    private Double currentValue;
    private Boolean isDerived = false;
    private Double positionX;
    private Double positionY;
    private String userId;
    private String kind;
}
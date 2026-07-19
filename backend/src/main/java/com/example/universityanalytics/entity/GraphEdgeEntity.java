package com.example.universityanalytics.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

@Entity
@Table(name = "graph_edges")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GraphEdgeEntity {
    @Id
    private String id;
    private String sourceId;
    private String targetId;
    private String operator;
    private String userId;
}
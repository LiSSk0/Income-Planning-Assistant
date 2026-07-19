package com.example.universityanalytics.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "scenarios")
@Data
public class ScenarioEntity {
    @Id
    private String id;
    private String name;
    @Column(columnDefinition = "CLOB")
    private String paramsJson;
    @Column(columnDefinition = "CLOB")
    private String resultJson;
    private LocalDateTime createdAt;
    private String userId;
}
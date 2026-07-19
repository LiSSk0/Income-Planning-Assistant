package com.example.universityanalytics.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "anomaly_corrections")
@Data
public class AnomalyCorrectionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fact_id", nullable = false)
    private Long factId;  // ID записи в таблице facts

    @Column(name = "original_value", nullable = false)
    private Double originalValue;

    @Column(name = "cleaned_value", nullable = false)
    private Double cleanedValue;

    @Column(name = "period", nullable = false)
    private String period;

    @Column(name = "subject", nullable = false)
    private String subject;

    @Column(name = "indicator", nullable = false)
    private String indicator;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "user_id")
    private String userId;
}
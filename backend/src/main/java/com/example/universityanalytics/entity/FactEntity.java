package com.example.universityanalytics.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "facts")
public class FactEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String period;
    private String district;
    private String subject;
    private String indicator;
    private String unit;

    @Column(name = "fact_value")  // ← ИЗМЕНИЛ НАЗВАНИЕ!
    private Double value;

    public FactEntity() {}

    public FactEntity(String period, String district, String subject, String indicator, String unit, Double value) {
        this.period = period;
        this.district = district;
        this.subject = subject;
        this.indicator = indicator;
        this.unit = unit;
        this.value = value;
    }

    // ... геттеры и сеттеры (оставляем как были)
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getPeriod() { return period; }
    public void setPeriod(String period) { this.period = period; }

    public String getDistrict() { return district; }
    public void setDistrict(String district) { this.district = district; }

    public String getSubject() { return subject; }
    public void setSubject(String subject) { this.subject = subject; }

    public String getIndicator() { return indicator; }
    public void setIndicator(String indicator) { this.indicator = indicator; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public Double getValue() { return value; }
    public void setValue(Double value) { this.value = value; }
}
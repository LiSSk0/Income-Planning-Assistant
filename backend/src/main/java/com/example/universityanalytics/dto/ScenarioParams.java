package com.example.universityanalytics.dto;

import java.util.*;

public class ScenarioParams {
    private String name;
    private String targetSubject;
    private String targetIndicator;
    private int periodFrom;
    private int horizonMonths;
    private boolean seasonality;
    private String method; // "growth-rate", "avg-3m", "avg-6m", "sarimax"
    private Map<String, Double> driverMultipliers;

    // геттеры и сеттеры
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getTargetSubject() { return targetSubject; }
    public void setTargetSubject(String targetSubject) { this.targetSubject = targetSubject; }

    public String getTargetIndicator() { return targetIndicator; }
    public void setTargetIndicator(String targetIndicator) { this.targetIndicator = targetIndicator; }

    public int getPeriodFrom() { return periodFrom; }
    public void setPeriodFrom(int periodFrom) { this.periodFrom = periodFrom; }

    public int getHorizonMonths() { return horizonMonths; }
    public void setHorizonMonths(int horizonMonths) { this.horizonMonths = horizonMonths; }

    public boolean isSeasonality() { return seasonality; }
    public void setSeasonality(boolean seasonality) { this.seasonality = seasonality; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public Map<String, Double> getDriverMultipliers() { return driverMultipliers; }
    public void setDriverMultipliers(Map<String, Double> driverMultipliers) { this.driverMultipliers = driverMultipliers; }
}
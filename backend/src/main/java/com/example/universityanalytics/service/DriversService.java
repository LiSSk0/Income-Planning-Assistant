package com.example.universityanalytics.service;

import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.FactRepository;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class DriversService {

    private final FactRepository factRepository;

    public DriversService(FactRepository factRepository) {
        this.factRepository = factRepository;
    }

    public List<DriverRow> getDrivers(String subject, String indicator) {
        List<FactEntity> facts = factRepository.findBySubject(subject);
        if (facts.isEmpty()) return Collections.emptyList();

        List<FactEntity> filtered = facts.stream()
                .filter(f -> f.getIndicator().equals(indicator))
                .sorted(Comparator.comparing(FactEntity::getPeriod))
                .collect(Collectors.toList());

        if (filtered.isEmpty()) return Collections.emptyList();

        List<DriverRow> result = new ArrayList<>();
        Double previousValue = null;

        for (FactEntity f : filtered) {
            DriverRow row = new DriverRow();
            row.setReportPeriod(f.getPeriod() + "-01");
            row.setSubjectRf(subject);
            row.setIndicator(indicator);
            row.setValue(f.getValue());
            row.setLag1(previousValue);

            if (previousValue != null && previousValue != 0) {
                double change = ((f.getValue() - previousValue) / previousValue) * 100;
                row.setChangePct(Math.round(change * 100.0) / 100.0);
            }

            result.add(row);
            previousValue = f.getValue();
        }

        return result;
    }

    public static class DriverRow {
        private String reportPeriod;
        private String subjectRf;
        private String indicator;
        private Double value;
        private Double lag1;
        private Double changePct;

        public String getReportPeriod() { return reportPeriod; }
        public void setReportPeriod(String reportPeriod) { this.reportPeriod = reportPeriod; }

        public String getSubjectRf() { return subjectRf; }
        public void setSubjectRf(String subjectRf) { this.subjectRf = subjectRf; }

        public String getIndicator() { return indicator; }
        public void setIndicator(String indicator) { this.indicator = indicator; }

        public Double getValue() { return value; }
        public void setValue(Double value) { this.value = value; }

        public Double getLag1() { return lag1; }
        public void setLag1(Double lag1) { this.lag1 = lag1; }

        public Double getChangePct() { return changePct; }
        public void setChangePct(Double changePct) { this.changePct = changePct; }
    }
}
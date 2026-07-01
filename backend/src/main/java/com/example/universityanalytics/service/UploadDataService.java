package com.example.universityanalytics.service;

import com.example.universityanalytics.entity.FactEntity;
import com.example.universityanalytics.repository.FactRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UploadDataService {

    private static final Logger log = LoggerFactory.getLogger(UploadDataService.class);
    private final FactRepository factRepository;
    private final ExcelParserService excelParserService;

    public UploadDataService(FactRepository factRepository, ExcelParserService excelParserService) {
        this.factRepository = factRepository;
        this.excelParserService = excelParserService;
    }

    @Transactional
    public void uploadAndUpsert(MultipartFile file) throws Exception {
        List<FactEntity> newFacts = excelParserService.parseExcel(file);
        if (newFacts.isEmpty()) {
            throw new IllegalArgumentException("Файл не содержит данных для загрузки");
        }

        Map<String, List<FactEntity>> newGrouped = newFacts.stream()
                .collect(Collectors.groupingBy(f -> f.getPeriod() + "|" + f.getSubject()));

        for (Map.Entry<String, List<FactEntity>> entry : newGrouped.entrySet()) {
            String[] parts = entry.getKey().split("\\|");
            String period = parts[0];
            String subject = parts[1];
            List<FactEntity> factsForThisCell = entry.getValue();

            factRepository.deleteByPeriodAndSubject(period, subject);
            factRepository.saveAll(factsForThisCell);
        }

        addMissingIndicators(newFacts);

        log.info("Загрузка завершена: Upsert {} записей", newFacts.size());
    }

    private void addMissingIndicators(List<FactEntity> newFacts) {
        Set<String> existingIndicators = new HashSet<>(factRepository.findDistinctIndicators());
        Set<String> newIndicators = newFacts.stream()
                .map(FactEntity::getIndicator)
                .collect(Collectors.toSet());

        Set<String> missing = newIndicators.stream()
                .filter(i -> !existingIndicators.contains(i))
                .collect(Collectors.toSet());

        if (missing.isEmpty()) return;

        List<String> allPeriods = factRepository.findAllPeriods();
        List<String> allSubjects = factRepository.findAllSubjects();

        List<FactEntity> zeroFacts = new ArrayList<>();
        for (String period : allPeriods) {
            for (String subject : allSubjects) {
                for (String indicator : missing) {
                    boolean exists = factRepository.existsByPeriodAndSubjectAndIndicator(period, subject, indicator);
                    if (!exists) {
                        FactEntity zero = new FactEntity();
                        zero.setPeriod(period);
                        zero.setSubject(subject);
                        zero.setIndicator(indicator);
                        zero.setUnit("чел");
                        zero.setValue(0.0);
                        zeroFacts.add(zero);
                    }
                }
            }
        }

        if (!zeroFacts.isEmpty()) {
            factRepository.saveAll(zeroFacts);
            log.info("Добавлено {} записей с нулевыми значениями для новых индикаторов", zeroFacts.size());
        }
    }
}
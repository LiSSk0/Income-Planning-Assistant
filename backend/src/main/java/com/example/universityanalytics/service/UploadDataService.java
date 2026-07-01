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
        // 1. Парсим новый файл
        List<FactEntity> newFacts = excelParserService.parseExcel(file);
        if (newFacts.isEmpty()) {
            throw new IllegalArgumentException("Файл не содержит данных для загрузки");
        }

        // 2. Группируем новые данные по (period, subject)
        Map<String, List<FactEntity>> newGrouped = newFacts.stream()
                .collect(Collectors.groupingBy(f -> f.getPeriod() + "|" + f.getSubject()));

        // 3. Для каждой группы: удаляем старые записи, вставляем новые (полный Upsert)
        for (Map.Entry<String, List<FactEntity>> entry : newGrouped.entrySet()) {
            String[] parts = entry.getKey().split("\\|");
            String period = parts[0];
            String subject = parts[1];
            List<FactEntity> factsForThisCell = entry.getValue();

            // Удаляем старые данные за этот период и регион
            factRepository.deleteByPeriodAndSubject(period, subject);
            // Вставляем новые
            factRepository.saveAll(factsForThisCell);
        }

        // 4. Добавляем нулевые значения для новых индикаторов
        addMissingIndicators(newFacts);

        log.info("Загрузка завершена: Upsert {} записей", newFacts.size());
    }

    private void addMissingIndicators(List<FactEntity> newFacts) {
        // Какие индикаторы уже есть в БД
        Set<String> existingIndicators = new HashSet<>(factRepository.findDistinctIndicators());
        // Какие индикаторы пришли в новом файле
        Set<String> newIndicators = newFacts.stream()
                .map(FactEntity::getIndicator)
                .collect(Collectors.toSet());

        // Индикаторы, которых ещё нет в БД
        Set<String> missing = newIndicators.stream()
                .filter(i -> !existingIndicators.contains(i))
                .collect(Collectors.toSet());

        if (missing.isEmpty()) return;

        // Получаем все существующие (period, subject)
        List<String> allPeriods = factRepository.findAllPeriods();
        List<String> allSubjects = factRepository.findAllSubjects();

        List<FactEntity> zeroFacts = new ArrayList<>();
        for (String period : allPeriods) {
            for (String subject : allSubjects) {
                for (String indicator : missing) {
                    // Проверяем, нет ли уже записи для этого периода, субъекта и индикатора
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
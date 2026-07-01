package com.example.universityanalytics.service;

import com.example.universityanalytics.entity.FactEntity;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.*;

@Service
public class ExcelParserService {

    private static final Logger log = LoggerFactory.getLogger(ExcelParserService.class);

    public List<FactEntity> parseExcel(MultipartFile file) throws Exception {
        List<FactEntity> facts = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new IllegalArgumentException("Файл пуст или нет заголовков");

            int periodIdx = -1, districtIdx = -1, subjectIdx = -1;
            int indicatorIdx = -1, unitIdx = -1, valueIdx = -1;

            for (Cell cell : headerRow) {
                String header = cell.getStringCellValue().trim().toLowerCase();
                switch (header) {
                    case "отчетный период":
                    case "период":
                        periodIdx = cell.getColumnIndex();
                        break;
                    case "федеральный округ рф":
                    case "округ":
                        districtIdx = cell.getColumnIndex();
                        break;
                    case "субъект рф":
                    case "регион":
                        subjectIdx = cell.getColumnIndex();
                        break;
                    case "показатель":
                        indicatorIdx = cell.getColumnIndex();
                        break;
                    case "мера измерения":
                    case "ед.изм.":
                        unitIdx = cell.getColumnIndex();
                        break;
                    case "значение":
                        valueIdx = cell.getColumnIndex();
                        break;
                }
            }

            if (periodIdx == -1 || subjectIdx == -1 || indicatorIdx == -1 || valueIdx == -1) {
                throw new IllegalArgumentException("Не найдены обязательные колонки");
            }

            for (Row row : sheet) {
                if (row.getRowNum() == 0) continue;

                String rawPeriod = getCellString(row, periodIdx);
                String period = normalizePeriod(rawPeriod); // <-- ГЛАВНОЕ ИСПРАВЛЕНИЕ!

                String district = districtIdx != -1 ? getCellString(row, districtIdx) : "";
                String subject = getCellString(row, subjectIdx);
                String indicator = getCellString(row, indicatorIdx);
                String unit = unitIdx != -1 ? getCellString(row, unitIdx) : detectUnit(indicator);
                Double value = getCellNumeric(row, valueIdx);

                if (period.isEmpty() || subject.isEmpty() || indicator.isEmpty() || value == null) {
                    log.warn("Пропущена строка {}", row.getRowNum());
                    continue;
                }

                FactEntity fact = new FactEntity();
                fact.setPeriod(period);
                fact.setDistrict(district);
                fact.setSubject(subject);
                fact.setIndicator(indicator);
                fact.setUnit(unit);
                fact.setValue(value);
                facts.add(fact);
            }
        }
        return facts;
    }

    // ============================================================
    // НОВЫЙ МЕТОД: Приводит "Май 20" к "2020-05"
    // ============================================================
    private String normalizePeriod(String raw) {
        if (raw == null || raw.isEmpty()) return raw;

        // Убираем лишние пробелы
        raw = raw.trim();

        // Если уже в формате YYYY-MM — возвращаем как есть
        if (raw.matches("\\d{4}-\\d{2}")) {
            return raw;
        }

        // Парсим "Май 20" → месяц и год
        String[] parts = raw.split(" ");
        if (parts.length != 2) {
            log.warn("Не удалось распарсить период: {}", raw);
            return raw;
        }

        String monthName = parts[0];
        String yearStr = parts[1];

        // Сопоставляем русские названия месяцев с номерами
        Map<String, Integer> monthMap = new HashMap<>();
        monthMap.put("Январь", 1);
        monthMap.put("Февраль", 2);
        monthMap.put("Март", 3);
        monthMap.put("Апрель", 4);
        monthMap.put("Май", 5);
        monthMap.put("Июнь", 6);
        monthMap.put("Июль", 7);
        monthMap.put("Август", 8);
        monthMap.put("Сентябрь", 9);
        monthMap.put("Октябрь", 10);
        monthMap.put("Ноябрь", 11);
        monthMap.put("Декабрь", 12);

        Integer month = monthMap.get(monthName);
        if (month == null) {
            log.warn("Неизвестный месяц: {}", monthName);
            return raw;
        }

        // Определяем полный год (если "20" → "2020", если "15" → "2015")
        int year = Integer.parseInt(yearStr);
        if (year < 100) {
            year = 2000 + year;
        }

        return String.format("%d-%02d", year, month);
    }

    private String getCellString(Row row, int index) {
        Cell cell = row.getCell(index);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> String.valueOf(cell.getNumericCellValue());
            default -> "";
        };
    }

    private Double getCellNumeric(Row row, int index) {
        Cell cell = row.getCell(index);
        if (cell == null) return null;
        return switch (cell.getCellType()) {
            case NUMERIC -> cell.getNumericCellValue();
            case STRING -> {
                try {
                    yield Double.parseDouble(cell.getStringCellValue().replace(",", "."));
                } catch (NumberFormatException e) {
                    yield null;
                }
            }
            default -> null;
        };
    }

    private String detectUnit(String indicator) {
        String low = indicator.toLowerCase();
        if (low.contains("руб") || low.contains("доход") || low.contains("объем") || low.contains("стоимость")) {
            return "руб";
        } else if (low.contains("%") || low.contains("доля")) {
            return "%";
        } else {
            return "чел";
        }
    }
}
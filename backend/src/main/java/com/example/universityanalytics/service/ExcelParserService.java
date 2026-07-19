package com.example.universityanalytics.service;

import com.example.universityanalytics.entity.FactEntity;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class ExcelParserService {

    private static final Logger log = LoggerFactory.getLogger(ExcelParserService.class);

    private static final Map<String, Integer> MONTH_MAP = new HashMap<>();
    static {
        MONTH_MAP.put("январь", 1);
        MONTH_MAP.put("янв", 1);
        MONTH_MAP.put("февраль", 2);
        MONTH_MAP.put("фев", 2);
        MONTH_MAP.put("март", 3);
        MONTH_MAP.put("мар", 3);
        MONTH_MAP.put("апрель", 4);
        MONTH_MAP.put("апр", 4);
        MONTH_MAP.put("май", 5);
        MONTH_MAP.put("июнь", 6);
        MONTH_MAP.put("июн", 6);
        MONTH_MAP.put("июль", 7);
        MONTH_MAP.put("июл", 7);
        MONTH_MAP.put("август", 8);
        MONTH_MAP.put("авг", 8);
        MONTH_MAP.put("сентябрь", 9);
        MONTH_MAP.put("сен", 9);
        MONTH_MAP.put("октябрь", 10);
        MONTH_MAP.put("окт", 10);
        MONTH_MAP.put("ноябрь", 11);
        MONTH_MAP.put("ноя", 11);
        MONTH_MAP.put("декабрь", 12);
        MONTH_MAP.put("дек", 12);
    }

    public List<FactEntity> parseExcel(MultipartFile file) throws Exception {
        List<FactEntity> facts = new ArrayList<>();

        log.info("Парсинг файла: {}", file.getOriginalFilename());

        try (InputStream is = file.getInputStream();
             Workbook workbook = new XSSFWorkbook(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet == null) {
                throw new IllegalArgumentException("Лист не найден");
            }

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                throw new IllegalArgumentException("Файл пуст или нет заголовков");
            }

            int periodIdx = -1, districtIdx = -1, subjectIdx = -1;
            int indicatorIdx = -1, unitIdx = -1, valueIdx = -1;

            for (Cell cell : headerRow) {
                String header = getStringValue(cell);
                if (header == null) continue;
                header = header.trim().toLowerCase();
                int idx = cell.getColumnIndex();

                if (header.contains("отчетный период") || header.contains("период") || header.contains("дата")) {
                    periodIdx = idx;
                } else if (header.contains("федеральный округ") || header.contains("округ")) {
                    districtIdx = idx;
                } else if (header.contains("субъект") || header.contains("регион")) {
                    subjectIdx = idx;
                } else if (header.contains("показатель") || header.contains("индикатор")) {
                    indicatorIdx = idx;
                } else if (header.contains("мера измерения") || header.contains("ед.изм.") || header.contains("единица")) {
                    unitIdx = idx;
                } else if (header.contains("значение") || header.contains("величина")) {
                    valueIdx = idx;
                }
            }

            if (periodIdx == -1 || subjectIdx == -1 || indicatorIdx == -1 || valueIdx == -1) {
                throw new IllegalArgumentException("Не найдены обязательные колонки");
            }

            int parsedCount = 0;
            int skippedCount = 0;

            for (Row row : sheet) {
                if (row.getRowNum() == 0) continue;

                try {
                    // === ГЛАВНОЕ: читаем период из ячейки ===
                    Cell periodCell = row.getCell(periodIdx);
                    String period = getPeriodFromCell(periodCell);
                    if (period == null) {
                        skippedCount++;
                        continue;
                    }

                    String subject = getStringValue(row.getCell(subjectIdx));
                    if (subject == null || subject.trim().isEmpty()) {
                        skippedCount++;
                        continue;
                    }
                    subject = subject.trim();

                    String indicator = getStringValue(row.getCell(indicatorIdx));
                    if (indicator == null || indicator.trim().isEmpty()) {
                        skippedCount++;
                        continue;
                    }
                    indicator = indicator.trim();

                    Double value = getNumericValue(row.getCell(valueIdx));
                    if (value == null) {
                        skippedCount++;
                        continue;
                    }

                    String district = districtIdx != -1 ? getStringValue(row.getCell(districtIdx)) : "";
                    if (district == null) district = "";
                    String unit = unitIdx != -1 ? getStringValue(row.getCell(unitIdx)) : detectUnit(indicator);
                    if (unit == null || unit.isEmpty()) unit = detectUnit(indicator);

                    FactEntity fact = new FactEntity();
                    fact.setPeriod(period);
                    fact.setDistrict(district);
                    fact.setSubject(subject);
                    fact.setIndicator(indicator);
                    fact.setUnit(unit);
                    fact.setValue(value);
                    facts.add(fact);
                    parsedCount++;

                } catch (Exception e) {
                    log.warn("Ошибка в строке {}: {}", row.getRowNum(), e.getMessage());
                    skippedCount++;
                }
            }

            log.info("Распарсено: {}, пропущено: {}", parsedCount, skippedCount);

            if (facts.isEmpty()) {
                throw new IllegalArgumentException("Файл не содержит данных для загрузки");
            }

            return facts;

        } catch (Exception e) {
            log.error("Ошибка парсинга: {}", e.getMessage(), e);
            throw e;
        }
    }

    /**
     * Универсальное чтение периода из ячейки
     */
    private String getPeriodFromCell(Cell cell) {
        if (cell == null) return null;

        // === СЛУЧАЙ 1: Ячейка содержит ДАТУ (число с форматом даты) ===
        if (cell.getCellType() == CellType.NUMERIC && DateUtil.isCellDateFormatted(cell)) {
            Date date = cell.getDateCellValue();
            SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM");
            return sdf.format(date);
        }

        // === СЛУЧАЙ 2: Ячейка содержит ЧИСЛО (Excel дата как число) ===
        if (cell.getCellType() == CellType.NUMERIC) {
            double num = cell.getNumericCellValue();
            // Excel даты: 1 января 1900 = 1, 1 января 2015 = 42004
            if (num > 1000 && num < 50000) {
                LocalDate date = LocalDate.of(1900, 1, 1).plusDays((long) num - 2);
                return String.format("%d-%02d", date.getYear(), date.getMonthValue());
            }
            // Если число не похоже на дату, пробуем как строку
            String raw = String.valueOf((long) num);
            return normalizePeriod(raw);
        }

        // === СЛУЧАЙ 3: Ячейка содержит СТРОКУ ===
        String raw = getStringValue(cell);
        if (raw == null || raw.isEmpty()) return null;

        return normalizePeriod(raw);
    }

    /**
     * Нормализация периода в формат YYYY-MM
     */
    private String normalizePeriod(String raw) {
        if (raw == null || raw.isEmpty()) return null;

        raw = raw.trim()
                .replace('\u00A0', ' ')
                .replaceAll("\\s+", " ")
                .trim();

        // Уже YYYY-MM
        if (raw.matches("\\d{4}-\\d{2}")) {
            return raw;
        }

        // "Январь 15" или "Янв 15"
        // Пробуем через поиск месяца
        String lower = raw.toLowerCase();
        for (Map.Entry<String, Integer> entry : MONTH_MAP.entrySet()) {
            if (lower.contains(entry.getKey())) {
                String monthName = entry.getKey();
                Integer month = entry.getValue();
                // Ищем цифры ПОСЛЕ месяца
                int monthIdx = lower.indexOf(monthName) + monthName.length();
                String after = raw.substring(Math.min(monthIdx, raw.length())).trim();
                // Извлекаем все цифры
                String digits = after.replaceAll("[^0-9]", "");
                if (!digits.isEmpty()) {
                    try {
                        int year = Integer.parseInt(digits);
                        if (year < 100) year = 2000 + year;
                        if (year >= 1900 && year <= 2100) {
                            return String.format("%d-%02d", year, month);
                        }
                    } catch (NumberFormatException e) {
                        // игнорируем
                    }
                }
                break;
            }
        }

        // "2025-01-01"
        if (raw.matches("\\d{4}-\\d{2}-\\d{2}.*")) {
            try {
                String[] parts = raw.split("-");
                return String.format("%d-%02d", Integer.parseInt(parts[0]), Integer.parseInt(parts[1]));
            } catch (Exception e) {
                // игнорируем
            }
        }

        // "01.2025" или "01/2025"
        if (raw.matches("\\d{1,2}[/.]\\d{4}")) {
            try {
                String[] parts = raw.split("[/.]");
                int month = Integer.parseInt(parts[0]);
                int year = Integer.parseInt(parts[1]);
                if (month >= 1 && month <= 12) {
                    return String.format("%d-%02d", year, month);
                }
            } catch (Exception e) {
                // игнорируем
            }
        }

        // "2025.01" или "2025/01"
        if (raw.matches("\\d{4}[/.]\\d{1,2}")) {
            try {
                String[] parts = raw.split("[/.]");
                int year = Integer.parseInt(parts[0]);
                int month = Integer.parseInt(parts[1]);
                if (month >= 1 && month <= 12) {
                    return String.format("%d-%02d", year, month);
                }
            } catch (Exception e) {
                // игнорируем
            }
        }

        log.warn("Не распознан период: '{}'", raw);
        return null;
    }

    private String getStringValue(Cell cell) {
        if (cell == null) return null;
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                if (DateUtil.isCellDateFormatted(cell)) {
                    return new SimpleDateFormat("yyyy-MM-dd").format(cell.getDateCellValue());
                }
                return String.valueOf(cell.getNumericCellValue());
            case FORMULA:
                try {
                    return cell.getStringCellValue().trim();
                } catch (Exception e) {
                    try {
                        return String.valueOf(cell.getNumericCellValue());
                    } catch (Exception e2) {
                        return null;
                    }
                }
            default:
                return null;
        }
    }

    private Double getNumericValue(Cell cell) {
        if (cell == null) return null;
        switch (cell.getCellType()) {
            case NUMERIC:
                return cell.getNumericCellValue();
            case STRING:
                try {
                    return Double.parseDouble(cell.getStringCellValue().trim().replace(",", "."));
                } catch (NumberFormatException e) {
                    return null;
                }
            case FORMULA:
                try {
                    return cell.getNumericCellValue();
                } catch (Exception e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private String detectUnit(String indicator) {
        if (indicator == null) return "чел";
        String low = indicator.toLowerCase();
        if (low.contains("руб") || low.contains("доход") || low.contains("объем") || low.contains("объём") ||
                low.contains("стоимость") || low.contains("оборот") || low.contains("выручка") || low.contains("прибыль")) {
            return "руб";
        } else if (low.contains("%") || low.contains("доля") || low.contains("ставка") || low.contains("тариф")) {
            return "%";
        } else if (low.contains("кг") || low.contains("тонн") || low.contains("грамм") || low.contains("килограмм")) {
            return "кг";
        } else if (low.contains("шт") || low.contains("штук") || low.contains("кур") || low.contains("банан")) {
            return "шт";
        } else {
            return "чел";
        }
    }
}
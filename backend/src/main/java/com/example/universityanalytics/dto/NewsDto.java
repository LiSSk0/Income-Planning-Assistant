package com.example.universityanalytics.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NewsDto {
    private String id;
    private String title;
    private String summary;
    private String source;
    private String date;
    private String url;
    private String impact;
    private Boolean presumed;
    private String relatedPeriod;
}
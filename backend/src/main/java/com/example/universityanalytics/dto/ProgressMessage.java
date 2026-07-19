package com.example.universityanalytics.dto;

public class ProgressMessage {
    private String phase;
    private Integer percent;
    private String message;
    private String uploadId;

    public ProgressMessage() {}

    public ProgressMessage(String phase, Integer percent, String message, String uploadId) {
        this.phase = phase;
        this.percent = percent;
        this.message = message;
        this.uploadId = uploadId;
    }

    public String getPhase() { return phase; }
    public void setPhase(String phase) { this.phase = phase; }

    public Integer getPercent() { return percent; }
    public void setPercent(Integer percent) { this.percent = percent; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getUploadId() { return uploadId; }
    public void setUploadId(String uploadId) { this.uploadId = uploadId; }
}
package com.example.universityanalytics.service;

import com.example.universityanalytics.dto.ProgressMessage;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class ProgressService {

    private final SimpMessagingTemplate messagingTemplate;

    public ProgressService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void sendProgress(String uploadId, String phase, Integer percent, String message) {
        ProgressMessage progress = new ProgressMessage(phase, percent, message, null);
        messagingTemplate.convertAndSend("/topic/upload/" + uploadId, progress);
    }

    public void sendCompleted(String uploadId, String message) {
        ProgressMessage progress = new ProgressMessage("COMPLETED", 100, message, uploadId);
        messagingTemplate.convertAndSend("/topic/upload/" + uploadId, progress);
    }
}
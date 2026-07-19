package com.example.universityanalytics;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class UniversityAnalyticsApplication {

	public static void main(String[] args) {
		SpringApplication.run(UniversityAnalyticsApplication.class, args);
	}
}
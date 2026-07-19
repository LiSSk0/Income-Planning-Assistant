package com.example.universityanalytics.repository;

import com.example.universityanalytics.entity.ScenarioEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ScenarioRepository extends JpaRepository<ScenarioEntity, String> {
    List<ScenarioEntity> findByUserIdOrderByCreatedAtDesc(String userId);
}
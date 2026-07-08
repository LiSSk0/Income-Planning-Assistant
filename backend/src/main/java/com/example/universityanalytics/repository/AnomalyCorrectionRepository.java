package com.example.universityanalytics.repository;

import com.example.universityanalytics.entity.AnomalyCorrectionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface AnomalyCorrectionRepository extends JpaRepository<AnomalyCorrectionEntity, Long> {
    List<AnomalyCorrectionEntity> findByUserId(String userId);
    boolean existsByUserId(String userId);
    void deleteByUserId(String userId);
}
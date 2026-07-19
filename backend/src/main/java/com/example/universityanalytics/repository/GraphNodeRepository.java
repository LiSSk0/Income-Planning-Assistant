package com.example.universityanalytics.repository;

import com.example.universityanalytics.entity.GraphNodeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GraphNodeRepository extends JpaRepository<GraphNodeEntity, String> {
    List<GraphNodeEntity> findByUserId(String userId);
    void deleteByUserId(String userId);
}
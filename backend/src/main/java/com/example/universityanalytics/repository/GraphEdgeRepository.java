package com.example.universityanalytics.repository;

import com.example.universityanalytics.entity.GraphEdgeEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface GraphEdgeRepository extends JpaRepository<GraphEdgeEntity, String> {
    List<GraphEdgeEntity> findByUserId(String userId);
    void deleteByUserId(String userId);
    List<GraphEdgeEntity> findByTargetId(String targetId);
}
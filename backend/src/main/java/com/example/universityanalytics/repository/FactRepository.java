package com.example.universityanalytics.repository;

import com.example.universityanalytics.entity.FactEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

public interface FactRepository extends JpaRepository<FactEntity, Long> {

    List<FactEntity> findBySubject(String subject);

    List<FactEntity> findBySubjectAndPeriodBetween(String subject, String start, String end);

    List<FactEntity> findByPeriod(String period);

    @Modifying
    @Transactional
    @Query("DELETE FROM FactEntity f WHERE f.period = :period AND f.subject = :subject")
    void deleteByPeriodAndSubject(@Param("period") String period, @Param("subject") String subject);

    @Query("SELECT DISTINCT f.indicator FROM FactEntity f")
    List<String> findDistinctIndicators();

    @Query("SELECT DISTINCT f.subject FROM FactEntity f")
    List<String> findDistinctSubjects();

    @Query("SELECT DISTINCT f.period FROM FactEntity f ORDER BY f.period")
    List<String> findAllPeriods();

    @Query("SELECT DISTINCT f.subject FROM FactEntity f")
    List<String> findAllSubjects();

    @Query("SELECT COUNT(f) > 0 FROM FactEntity f WHERE f.period = :period AND f.subject = :subject AND f.indicator = :indicator")
    boolean existsByPeriodAndSubjectAndIndicator(@Param("period") String period,
                                                 @Param("subject") String subject,
                                                 @Param("indicator") String indicator);
}
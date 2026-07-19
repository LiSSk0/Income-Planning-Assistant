package com.example.universityanalytics.service;

import com.example.universityanalytics.dto.*;
import com.example.universityanalytics.entity.GraphEdgeEntity;
import com.example.universityanalytics.entity.GraphNodeEntity;
import com.example.universityanalytics.repository.GraphEdgeRepository;
import com.example.universityanalytics.repository.GraphNodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GraphService {

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;
    private static final String DEFAULT_USER = "default";

    @Transactional
    public BusinessGraphDto getGraph() {
        return getGraph(DEFAULT_USER);
    }

    @Transactional
    public BusinessGraphDto getGraph(String userId) {
        List<GraphNodeEntity> nodes = nodeRepository.findByUserId(userId);
        List<GraphEdgeEntity> edges = edgeRepository.findByUserId(userId);
        return mapToDto(nodes, edges);
    }

    @Transactional
    public void saveGraph(BusinessGraphDto graph) {
        saveGraph(graph, DEFAULT_USER);
    }

    @Transactional
    public void deleteGraph() {
        deleteGraph(DEFAULT_USER);
    }

    @Transactional
    public void deleteGraph(String userId) {
        nodeRepository.deleteByUserId(userId);
        edgeRepository.deleteByUserId(userId);
    }

    @Transactional
    public void saveGraph(BusinessGraphDto graph, String userId) {
        // Удаляем старые данные
        nodeRepository.deleteByUserId(userId);
        edgeRepository.deleteByUserId(userId);

        // Сохраняем узлы
        List<GraphNodeEntity> nodeEntities = new ArrayList<>();
        if (graph.getNodes() != null) {
            for (GraphNodeDto n : graph.getNodes()) {
                GraphNodeEntity e = new GraphNodeEntity();
                e.setId(n.getId() != null ? n.getId() : UUID.randomUUID().toString());
                e.setIndicator(n.getIndicator());
                e.setUnit(n.getUnit() != null ? n.getUnit() : "");
                e.setCurrentValue(n.getCurrentValue() != null ? n.getCurrentValue() : 0.0);
                e.setIsDerived(n.getIsDerived() != null && n.getIsDerived());
                e.setPositionX(n.getPositionX());
                e.setPositionY(n.getPositionY());
                e.setUserId(userId);
                // СОХРАНЯЕМ kind
                e.setKind(n.getKind() != null ? n.getKind() : "indicator");
                nodeEntities.add(e);
            }
        }
        if (!nodeEntities.isEmpty()) {
            nodeRepository.saveAll(nodeEntities);
        }

        // Сохраняем рёбра
        List<GraphEdgeEntity> edgeEntities = new ArrayList<>();
        if (graph.getEdges() != null) {
            for (GraphEdgeDto e : graph.getEdges()) {
                GraphEdgeEntity ee = new GraphEdgeEntity();
                ee.setId(e.getId() != null ? e.getId() : UUID.randomUUID().toString());
                ee.setSourceId(e.getSource());
                ee.setTargetId(e.getTarget());
                ee.setOperator(e.getOperator());
                ee.setUserId(userId);
                edgeEntities.add(ee);
            }
        }
        if (!edgeEntities.isEmpty()) {
            edgeRepository.saveAll(edgeEntities);
        }
    }

    public String autoBuildFormula(String targetId, List<String> sourceIds) {
        List<GraphEdgeEntity> edges = edgeRepository.findByTargetId(targetId);
        if (edges.isEmpty()) return "";

        StringBuilder formula = new StringBuilder();
        for (int i = 0; i < edges.size(); i++) {
            GraphEdgeEntity e = edges.get(i);
            if (i > 0) formula.append(" ").append(e.getOperator()).append(" ");
            formula.append(e.getSourceId());
        }
        return formula.toString();
    }

    private BusinessGraphDto mapToDto(List<GraphNodeEntity> nodes, List<GraphEdgeEntity> edges) {
        BusinessGraphDto dto = new BusinessGraphDto();
        dto.setNodes(nodes.stream().map(n -> {
            GraphNodeDto nd = new GraphNodeDto();
            nd.setId(n.getId());
            nd.setIndicator(n.getIndicator());
            nd.setUnit(n.getUnit());
            nd.setCurrentValue(n.getCurrentValue());
            nd.setIsDerived(n.getIsDerived());
            nd.setPositionX(n.getPositionX());
            nd.setPositionY(n.getPositionY());
            nd.setKind(n.getKind()); // ПРОПИСЫВАЕМ kind
            return nd;
        }).collect(Collectors.toList()));
        dto.setEdges(edges.stream().map(e -> {
            GraphEdgeDto ed = new GraphEdgeDto();
            ed.setId(e.getId());
            ed.setSource(e.getSourceId());
            ed.setTarget(e.getTargetId());
            ed.setOperator(e.getOperator());
            return ed;
        }).collect(Collectors.toList()));
        return dto;
    }
}
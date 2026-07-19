import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    Background,
    BackgroundVariant,
    Controls,
    MiniMap,
    ReactFlow,
    addEdge,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
    type NodeMouseHandler,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Workflow } from 'lucide-react'
import type { GraphOperator } from '@/shared/lib/api-types'
import { api } from '@/shared/lib/api'
import { Card, EmptyState, Skeleton } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { IndicatorNode } from './components/IndicatorNode'
import { OperationNode } from './components/OperationNode'
import { NodeInspector } from './components/NodeInspector'
import { GraphToolbar } from './components/GraphToolbar'
import { autoLayout } from './lib/layout'
import {
    buildEdge,
    isOperationNode,
    asIndicatorData,
    type IndicatorNodeData,
    type GraphNodeUnion,
} from './lib/mapToFlow'
import { buildGraphFormulas } from './lib/buildFormulas'
import { useGraphStore } from './store/useGraphStore'

const nodeTypes = { indicator: IndicatorNode, operation: OperationNode }

function miniMapNodeColor(node: Node): string {
    const data = node.data as IndicatorNodeData
    return data?.isDerived ? 'var(--accent-lime)' : 'var(--border-strong)'
}

export function BusinessGraphPage() {
    const [loading, setLoading] = useState(true)
    const [regenerating, setRegenerating] = useState(false)
    const [saving, setSaving] = useState(false)
    const [nodes, setNodes, onNodesChange] = useNodesState<GraphNodeUnion>([])
    const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
    const [operator, setOperator] = useState<GraphOperator>('+')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [justSaved, setJustSaved] = useState(false)
    const [initialized, setInitialized] = useState(false)

    const edgeSeq = useRef(0)
    const opSeq = useRef(0)
    const saveTimer = useRef<ReturnType<typeof setTimeout>>()

    const { setGraph, save, reset, markViewed, loadFromStorage, saveToCache } = useGraphStore()
    const { hasData, facts, indicators, loading: factsLoading } = useDatasetStore()

    useEffect(() => {
        markViewed()
    }, [markViewed])

    // ===== Построение графа из данных (только узлы-индикаторы) =====
    const buildGraphFromData = useCallback(() => {
        if (!hasData || facts.length === 0 || indicators.length === 0) {
            setNodes([])
            setEdges([])
            reset()
            return
        }

        const latestValues = new Map<string, { value: number; unit: string }>()
        for (const f of facts) {
            const key = f.indicator
            if (!latestValues.has(key) || f.period > latestValues.get(key)?.period) {
                latestValues.set(key, { value: f.value, unit: f.unit })
            }
        }

        const freshNodes: GraphNodeUnion[] = indicators.map((ind, i) => ({
            id: `ind-${ind}`,
            type: 'indicator' as const,
            position: { x: 50 + (i % 5) * 140, y: 50 + Math.floor(i / 5) * 120 },
            data: {
                indicator: ind,
                unit: latestValues.get(ind)?.unit || '—',
                currentValue: latestValues.get(ind)?.value || 0,
                isDerived: false,
            },
            deletable: false,
            kind: 'indicator' as const,
        }))

        const laidOut = autoLayout(freshNodes, [], 'LR')
        setNodes(laidOut)
        setEdges([])
        setGraph(laidOut, [])
    }, [hasData, facts, indicators, setNodes, setEdges, setGraph, reset])

    // ===== Загрузка с бэка с fallback на localStorage и построение из данных =====
    const loadGraph = useCallback(async () => {
        setLoading(true)
        try {
            const graph = await api.getGraph()
            if (graph.nodes && graph.nodes.length > 0) {
                const flowNodes: GraphNodeUnion[] = graph.nodes.map((n) => {
                    const isOp = n.kind === 'operation'
                    return {
                        id: n.id,
                        type: isOp ? 'operation' : 'indicator',
                        position: { x: n.positionX || 0, y: n.positionY || 0 },
                        data: isOp
                            ? { operator: n.indicator as GraphOperator }
                            : {
                                indicator: n.indicator || n.id,
                                unit: n.unit || '—',
                                currentValue: n.currentValue || 0,
                                isDerived: n.isDerived || false,
                            },
                        deletable: isOp ? true : false,
                        kind: n.kind || 'indicator',
                    }
                })

                // ✅ ИСПРАВЛЕНО: используем buildEdge для единообразного стиля ребер
                const flowEdges: Edge[] = graph.edges.map((e) =>
                    buildEdge(e.id, e.source, e.target, e.operator as GraphOperator)
                )

                setNodes(flowNodes)
                setEdges(flowEdges)
                setGraph(flowNodes, flowEdges)
                setLoading(false)
                return
            }
        } catch (e) {
            console.warn('Ошибка загрузки графа с бэка:', e)
        }

        // fallback на localStorage
        const cached = loadFromStorage()
        if (cached) {
            const { nodes: cachedNodes, edges: cachedEdges } = cached
            if (cachedNodes && cachedNodes.length > 0) {
                setNodes(cachedNodes)
                setEdges(cachedEdges || [])
                setLoading(false)
                return
            }
        }

        // построить из данных
        buildGraphFromData()
        setLoading(false)
    }, [buildGraphFromData, setNodes, setEdges, setGraph, loadFromStorage])

    // ===== Инициализация =====
    useEffect(() => {
        if (!factsLoading && !initialized) {
            loadGraph()
            setInitialized(true)
        }
    }, [factsLoading, loadGraph, initialized])

    // ===== Сохранить на бэк =====
    const handleSave = useCallback(async () => {
        if (nodes.length === 0 && edges.length === 0) {
            setJustSaved(true)
            setTimeout(() => setJustSaved(false), 1500)
            return
        }
        const payload = buildGraphFormulas(nodes, edges)
        setSaving(true)
        try {
            await api.saveGraphFormulas(payload)
            save(nodes, edges)
            setJustSaved(true)
            setTimeout(() => setJustSaved(false), 1500)
        } catch (e) {
            console.error('Ошибка сохранения графа:', e)
            alert('Не удалось сохранить граф. Проверьте соединение с сервером.')
        } finally {
            setSaving(false)
        }
    }, [nodes, edges, save])

    // ===== Регенерация (перестроить из данных и СРАЗУ СОХРАНИТЬ) =====
    const handleRegenerate = useCallback(async () => {
        setRegenerating(true)
        setSelectedId(null)

        // 1. Строим граф из данных (очищаем рёбра)
        const latestValues = new Map<string, { value: number; unit: string }>()
        for (const f of facts) {
            const key = f.indicator
            if (!latestValues.has(key) || f.period > latestValues.get(key)?.period) {
                latestValues.set(key, { value: f.value, unit: f.unit })
            }
        }

        const freshNodes: GraphNodeUnion[] = indicators.map((ind, i) => ({
            id: `ind-${ind}`,
            type: 'indicator' as const,
            position: { x: 50 + (i % 5) * 140, y: 50 + Math.floor(i / 5) * 120 },
            data: {
                indicator: ind,
                unit: latestValues.get(ind)?.unit || '—',
                currentValue: latestValues.get(ind)?.value || 0,
                isDerived: false,
            },
            deletable: false,
            kind: 'indicator' as const,
        }))

        const laidOut = autoLayout(freshNodes, [], 'LR')
        setNodes(laidOut)
        setEdges([])
        setGraph(laidOut, [])

        // 2. Сохраняем на бэк (пустые рёбра)
        const payload = buildGraphFormulas(laidOut, [])
        try {
            await api.saveGraphFormulas(payload)
            save(laidOut, [])
            setJustSaved(true)
            setTimeout(() => setJustSaved(false), 1500)
        } catch (e) {
            console.error('Ошибка сохранения после регенерации:', e)
            alert('Не удалось сохранить граф после регенерации.')
        }
        setRegenerating(false)
    }, [facts, indicators, setNodes, setEdges, setGraph, save])

    const handleClearEdges = useCallback(() => {
        setEdges([])
        setSelectedId(null)
    }, [setEdges])

    const handleAutoLayout = useCallback(() => {
        setNodes((nds) => autoLayout(nds, edges, 'LR'))
    }, [edges, setNodes])

    const handleAddOperation = useCallback(() => {
        const id = `op-${opSeq.current++}`
        const opNode: GraphNodeUnion = {
            id,
            type: 'operation',
            position: { x: 320 + opSeq.current * 24, y: 220 + opSeq.current * 24 },
            data: { operator },
            deletable: true,
            kind: 'operation' as const,
        }
        setNodes((nds) => [...nds, opNode])
    }, [operator, setNodes])

    const onConnect = useCallback(
        (connection: Connection) => {
            if (!connection.source || !connection.target) return
            const id = `e-user-${connection.source}-${connection.target}-${edgeSeq.current++}`
            const edge = buildEdge(id, connection.source, connection.target, operator)
            setEdges((eds) => addEdge(edge, eds))
        },
        [operator, setEdges],
    )

    const onNodeClick = useCallback<NodeMouseHandler>((_, node) => {
        setSelectedId(node.id)
    }, [])

    const handleToggleDerived = useCallback(
        (id: string) => {
            setNodes((nds) =>
                nds.map((n) => {
                    if (n.id !== id || isOperationNode(n)) return n
                    const d = asIndicatorData(n)
                    return { ...n, data: { ...d, isDerived: !d.isDerived } }
                }),
            )
        },
        [setNodes],
    )

    const selectedNode = useMemo(() => {
        const n = nodes.find((x) => x.id === selectedId)
        return n && !isOperationNode(n) ? n : null
    }, [nodes, selectedId])

    const isEmpty = !loading && nodes.length === 0

    // кешируем в localStorage при любом изменении (но НЕ отправляем на бэк)
    useEffect(() => {
        if (nodes.length > 0 || edges.length > 0) {
            saveToCache()
        }
    }, [nodes, edges, saveToCache])

    return (
        <div>
            <PageHeader
                title="Граф бизнес-модели"
                subtitle="Бизнес-модель как граф: соединяйте сущности операторами в производные узлы."
            />

            {!loading && (
                <div className="mb-3">
                    <GraphToolbar
                        operator={operator}
                        onOperatorChange={setOperator}
                        onAutoLayout={handleAutoLayout}
                        onClearEdges={handleClearEdges}
                        onRegenerate={handleRegenerate}
                        onSave={handleSave}
                        onAddOperation={handleAddOperation}
                        regenerating={regenerating}
                        hasEdges={edges.length > 0}
                        justSaved={justSaved}
                        saving={saving}
                    />
                </div>
            )}

            <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
                <Card className="overflow-hidden p-0">
                    {loading ? (
                        <Skeleton className="h-[640px] w-full" />
                    ) : isEmpty ? (
                        <div className="h-[640px]">
                            <EmptyState
                                icon={<Workflow className="h-8 w-8" />}
                                title={hasData ? "Граф пуст" : "Нет загруженных данных"}
                                description={hasData
                                    ? "Нажмите «Регенерация», чтобы построить граф из загруженных показателей."
                                    : "Загрузите данные в разделе «Загрузка данных», чтобы построить граф бизнес-модели."
                                }
                            />
                        </div>
                    ) : (
                        <div style={{ height: 'min(640px, calc(100vh - 320px))', minHeight: 480 }}>
                            <ReactFlow
                                nodes={nodes}
                                edges={edges}
                                onNodesChange={onNodesChange}
                                onEdgesChange={onEdgesChange}
                                onConnect={onConnect}
                                onNodeClick={onNodeClick}
                                onPaneClick={() => setSelectedId(null)}
                                nodeTypes={nodeTypes}
                                onlyRenderVisibleElements
                                deleteKeyCode={['Delete', 'Backspace']}
                                fitView
                                fitViewOptions={{ padding: 0.2 }}
                                proOptions={{ hideAttribution: true }}
                                minZoom={0.2}
                                maxZoom={1.75}
                            >
                                <Background
                                    variant={BackgroundVariant.Dots}
                                    gap={20}
                                    size={1}
                                    color="var(--border-strong)"
                                />
                                <Controls className="!border-border !bg-surface-card" showInteractive={false} />
                                <MiniMap
                                    pannable
                                    zoomable
                                    nodeColor={miniMapNodeColor}
                                    maskColor="rgba(7,16,12,0.7)"
                                    style={{
                                        background: 'var(--surface-card)',
                                        border: '1px solid var(--border-subtle)',
                                        borderRadius: 12,
                                    }}
                                />
                            </ReactFlow>
                        </div>
                    )}
                </Card>

                <div className="lg:sticky lg:top-4 lg:self-start">
                    {selectedNode ? (
                        <NodeInspector
                            node={selectedNode as Node<IndicatorNodeData>}
                            nodes={nodes}
                            edges={edges}
                            onClose={() => setSelectedId(null)}
                            onToggleDerived={handleToggleDerived}
                        />
                    ) : (
                        <Card>
                            <div className="px-5 py-12 text-center text-sm text-text-muted">
                                Выберите узел на графе, чтобы увидеть его формулу сборки и драйверы.
                            </div>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    )
}
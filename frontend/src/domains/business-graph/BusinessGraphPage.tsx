/* Центральный экран «Граф бизнес-модели» (раздел 3.3).
   Идея: бизнес-модель как направленный граф показателей — источники
   слева собираются операторами в производные узлы (доход) справа. */
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
import { BUSINESS_GRAPH } from '@/mocks/graph'
import { Card, EmptyState, Skeleton } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { IndicatorNode } from './components/IndicatorNode'
import { NodeInspector } from './components/NodeInspector'
import { GraphToolbar } from './components/GraphToolbar'
import { autoLayout } from './lib/layout'
import { buildEdge, mapToFlow, type IndicatorNodeData } from './lib/mapToFlow'
import { useGraphStore } from './store/useGraphStore'

const nodeTypes = { indicator: IndicatorNode }

/** Тёмный стиль для MiniMap (узлы — по производности). */
function miniMapNodeColor(node: Node): string {
  const data = node.data as IndicatorNodeData
  return data?.isDerived ? 'var(--accent-lime)' : 'var(--border-strong)'
}

export function BusinessGraphPage() {
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<IndicatorNodeData>>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [operator, setOperator] = useState<GraphOperator>('+')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  // Счётчик для уникальных id новых рёбер.
  const edgeSeq = useRef(0)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>()

  /** Запрос графа из БД → узлы БЕЗ связей → раскладка сеткой («квадрат»).
   *  При входе связей нет — пользователь настраивает их сам. */
  const loadGraph = useCallback(async () => {
    // Фолбэк на встроенный мок, если сеть/MSW недоступны.
    const graph = await api.getGraph().catch(() => BUSINESS_GRAPH)
    const flow = mapToFlow(graph)
    const baseNodes = flow.nodes.map((n) => ({
      ...n,
      // По умолчанию все сущности — базовые (источники). Производной
      // пользователь делает узел сам (в инспекторе по клику).
      data: { ...n.data, isDerived: false },
      // Узлы удалять нельзя — клавишей Delete убираются только связи.
      deletable: false,
    }))
    // Передаём пустой массив рёбер → autoLayout раскладывает узлы квадратом.
    setNodes(autoLayout(baseNodes, [], 'LR'))
    setEdges([])
  }, [setNodes, setEdges])

  // Первичная загрузка: если в сессии есть сохранённое состояние —
  // восстанавливаем его (чтобы правки не сбрасывались при смене вкладок),
  // иначе строим свежий граф из БД (узлы без связей).
  useEffect(() => {
    let alive = true
    setLoading(true)
    const { hasSaved, savedNodes, savedEdges } = useGraphStore.getState()
    if (hasSaved && savedNodes) {
      setNodes(savedNodes)
      setEdges(savedEdges ?? [])
      setLoading(false)
      return
    }
    loadGraph().finally(() => {
      if (alive) setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [loadGraph, setNodes, setEdges])

  // Чистим таймер отметки «Сохранено» при размонтировании.
  useEffect(() => () => clearTimeout(saveTimer.current), [])

  const handleAutoLayout = useCallback(() => {
    setNodes((nds) => autoLayout(nds, edges, 'LR'))
  }, [edges, setNodes])

  /** Очистка всех связей — узлы остаются, рёбра убираются. */
  const handleClearEdges = useCallback(() => {
    setEdges([])
    setSelectedId(null)
  }, [setEdges])

  /** Регенерация: перезапрос графа из БД (вдруг данные изменились),
   *  сброс сохранённого состояния, очистка связей и раскладка квадратом —
   *  заменяет канвас свежим состоянием из БД. */
  const handleRegenerate = useCallback(async () => {
    setRegenerating(true)
    setSelectedId(null)
    useGraphStore.getState().reset()
    try {
      await loadGraph()
    } finally {
      setRegenerating(false)
    }
  }, [loadGraph])

  /** Сохранить текущее состояние графа на время сессии (переживает
   *  переходы между вкладками). */
  const handleSave = useCallback(() => {
    useGraphStore.getState().save(nodes, edges)
    setJustSaved(true)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => setJustSaved(false), 2000)
  }, [nodes, edges])

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

  /** Переключить тип узла: базовый (источник) ↔ производный. */
  const handleToggleDerived = useCallback(
    (id: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, isDerived: !n.data.isDerived } } : n,
        ),
      )
    },
    [setNodes],
  )

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId],
  )

  const isEmpty = !loading && nodes.length === 0

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
            regenerating={regenerating}
            hasEdges={edges.length > 0}
            justSaved={justSaved}
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
                title="Граф пуст"
                description="Нажмите «Регенерация», чтобы перезапросить граф из базы данных и переразложить его на канвасе."
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
                // Удаление выделенной связи по Delete или Backspace.
                // Узлы помечены deletable:false — убираются только рёбра.
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
              node={selectedNode}
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

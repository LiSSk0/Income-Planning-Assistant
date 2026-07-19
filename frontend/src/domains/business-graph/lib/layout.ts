/* Авто-лэйаут графа бизнес-модели через dagre.
   Граф направленный (источники → производные), поэтому раскладка
   слева-направо ('LR') читается как «формула собирается вправо». */
import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'

/** Геометрия узла-показателя (см. IndicatorNode). */
export const NODE_WIDTH = 220
export const NODE_HEIGHT = 96

export type LayoutDirection = 'LR' | 'TB'

/**
 * Раскладывает узлы «квадратом» (сеткой) — используется, когда связей нет
 * и направленную dagre-раскладку строить не из чего (иначе узлы встают в
 * одну линию). Число столбцов ≈ √n, чтобы получить компактный квадрат.
 */
export function gridLayout<NodeData extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<NodeData>[],
): Node<NodeData>[] {
  const n = nodes.length
  if (n === 0) return nodes
  const cols = Math.ceil(Math.sqrt(n))
  const colGap = 60
  const rowGap = 48
  const stepX = NODE_WIDTH + colGap
  const stepY = NODE_HEIGHT + rowGap
  return nodes.map((node, i) => ({
    ...node,
    position: {
      x: 24 + (i % cols) * stepX,
      y: 24 + Math.floor(i / cols) * stepY,
    },
  }))
}

/**
 * Расставляет узлы и возвращает копию узлов с position.
 * Без рёбер — раскладка «квадратом» (gridLayout), иначе — направленная
 * dagre-раскладка. Существующие position перезаписываются.
 */
export function autoLayout<NodeData extends Record<string, unknown> = Record<string, unknown>>(
  nodes: Node<NodeData>[],
  edges: Edge[],
  direction: LayoutDirection = 'LR',
): Node<NodeData>[] {
  // Нет связей → строить направленный граф не из чего: dagre выложит всё
  // в одну линию. Раскладываем сеткой-квадратом.
  if (edges.length === 0) return gridLayout(nodes)

  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: direction,
    // Просторная раскладка: рёбра-операторы должны быть читаемы.
    nodesep: direction === 'LR' ? 40 : 60,
    ranksep: direction === 'LR' ? 120 : 80,
    marginx: 24,
    marginy: 24,
  })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  return nodes.map((node) => {
    const pos = g.node(node.id)
    if (!pos) return node
    // dagre отдаёт центр узла — React Flow ждёт левый верхний угол.
    return {
      ...node,
      position: {
        x: pos.x - NODE_WIDTH / 2,
        y: pos.y - NODE_HEIGHT / 2,
      },
    }
  })
}

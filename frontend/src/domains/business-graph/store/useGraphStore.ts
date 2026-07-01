import { create } from 'zustand'
import type { Edge, Node } from '@xyflow/react'
import type { IndicatorNodeData } from '../lib/mapToFlow'

type GraphNode = Node<IndicatorNodeData>

/* Сессионное хранилище состояния графа. Живёт на уровне модуля (zustand),
   поэтому переживает переходы между вкладками в рамках текущей сессии —
   но НЕ перезагрузку страницы (это «в пределах сессии», как и просили).
   Сохранение явное — по кнопке «Сохранить». */
interface GraphState {
  savedNodes: GraphNode[] | null
  savedEdges: Edge[] | null
  /** Есть ли сохранённое состояние (показывать его при возврате на вкладку). */
  hasSaved: boolean
  /** Сохранить текущее состояние канваса. */
  save: (nodes: GraphNode[], edges: Edge[]) => void
  /** Сбросить сохранение (например, при регенерации). */
  reset: () => void
}

export const useGraphStore = create<GraphState>((set) => ({
  savedNodes: null,
  savedEdges: null,
  hasSaved: false,
  save: (nodes, edges) =>
    set({
      // Клонируем, чтобы дальнейшие правки канваса не мутировали сохранённое.
      savedNodes: nodes.map((n) => ({ ...n, position: { ...n.position } })),
      savedEdges: edges.map((e) => ({ ...e })),
      hasSaved: true,
    }),
  reset: () => set({ savedNodes: null, savedEdges: null, hasSaved: false }),
}))

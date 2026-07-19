/* Рендер выражения графа с ПОДСВЕТКОЙ операторов их цветом (сложение —
   зелёным, умножение — синим и т.д.). Операция раскрывается как «(a × b)»,
   где символ оператора окрашен по OPERATOR_COLOR. */
import { Fragment, type ReactNode } from 'react'
import type { Edge } from '@xyflow/react'
import {
  OPERATOR_COLOR,
  OPERATOR_SYMBOL,
  isOperationNode,
  asOperationData,
  asIndicatorData,
  type GraphNodeUnion,
} from '../lib/mapToFlow'

interface Props {
  /** id источника (показатель или операция), выражение которого рисуем. */
  sourceId: string
  nodes: GraphNodeUnion[]
  edges: Edge[]
}

/** Цветной символ оператора. */
function op(sym: string, color: string, key?: string): ReactNode {
  return (
    <span key={key} className="font-bold" style={{ color }}>
      {sym}
    </span>
  )
}

function renderSource(
  sourceId: string,
  byId: Map<string, GraphNodeUnion>,
  incoming: Map<string, Edge[]>,
  seen: Set<string>,
): ReactNode {
  const node = byId.get(sourceId)
  if (!node) return sourceId
  if (!isOperationNode(node)) return asIndicatorData(node).indicator

  const operator = asOperationData(node).operator
  const sym = OPERATOR_SYMBOL[operator]
  const color = OPERATOR_COLOR[operator]

  if (seen.has(sourceId)) return op(sym, color)
  seen.add(sourceId)
  const incs = incoming.get(sourceId) ?? []
  const parts = incs.map((e) => renderSource(e.source, byId, incoming, seen))
  seen.delete(sourceId)

  if (parts.length === 0) return op(sym, color)

  const inner: ReactNode[] = []
  parts.forEach((p, i) => {
    if (i > 0) {
      inner.push(<Fragment key={`o${i}`}> {op(sym, color)} </Fragment>)
    }
    inner.push(<Fragment key={`p${i}`}>{p}</Fragment>)
  })

  return parts.length > 1 ? (
    <>
      {'('}
      {inner}
      {')'}
    </>
  ) : (
    <>{inner}</>
  )
}

export function FormulaExpression({ sourceId, nodes, edges }: Props) {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const incoming = new Map<string, Edge[]>()
  for (const e of edges) {
    const list = incoming.get(e.target) ?? []
    list.push(e)
    incoming.set(e.target, list)
  }
  return <>{renderSource(sourceId, byId, incoming, new Set())}</>
}

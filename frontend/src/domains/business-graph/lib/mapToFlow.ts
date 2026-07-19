/* Конвертация доменной модели BusinessGraph → структуры React Flow.
   Здесь же — единый источник правды по семантике операторов
   (человекочитаемый символ + цвет), используется и в рёбрах, и в инспекторе. */
import { MarkerType, type Edge, type Node } from '@xyflow/react'
import type { BusinessGraph, GraphOperator } from '@/shared/lib/api-types'
import { chartTheme } from '@/shared/ui/chartTheme'

/** data кастомного узла type:'indicator'. */
export interface IndicatorNodeData extends Record<string, unknown> {
    indicator: string
    unit: string
    currentValue: number
    isDerived: boolean
}

/** data промежуточного узла-операции type:'operation' (точка на графе,
 *  через которую собираются сложные формулы вида a*b+c или (a+b)*c). */
export interface OperationNodeData extends Record<string, unknown> {
    operator: GraphOperator
}

export type FlowNode = Node<IndicatorNodeData>
export type OperationNode = Node<OperationNodeData>
/** Данные любого узла графа. */
export type AnyNodeData = IndicatorNodeData | OperationNodeData
/** Любой узел графа: показатель или промежуточная операция. */
export type GraphNodeUnion = Node<AnyNodeData>

/** Узел-операция? Проверяем по наличию поля `operator` в data. */
export function isOperationNode(n: GraphNodeUnion): boolean {
    return n.type === 'operation' || 'operator' in n.data
}

/** Данные узла как операции (использовать после isOperationNode). */
export function asOperationData(n: GraphNodeUnion): OperationNodeData {
    return n.data as OperationNodeData
}

/** Данные узла как показателя (использовать, когда это не операция). */
export function asIndicatorData(n: GraphNodeUnion): IndicatorNodeData {
    return n.data as IndicatorNodeData
}

/** Человекочитаемый символ оператора для подписи ребра/формулы. */
export const OPERATOR_SYMBOL: Record<GraphOperator, string> = {
    '+': '+',
    '-': '−',
    '*': '×',
    '/': '÷',
    '%': '%',
}

/** Цвет ребра по оператору (синхронен с --op-* в tokens.css). */
export const OPERATOR_COLOR: Record<GraphOperator, string> = {
    '+': chartTheme.green,
    '-': chartTheme.red,
    '*': chartTheme.blue,
    '/': chartTheme.amber,
    '%': chartTheme.lime,
}

/** Подписи операторов для выпадающих списков. */
export const OPERATOR_OPTIONS: { value: GraphOperator; label: string }[] = [
    { value: '+', label: '+ сложение' },
    { value: '-', label: '− вычитание' },
    { value: '*', label: '× умножение' },
    { value: '/', label: '÷ деление' },
    { value: '%', label: '% доля' },
]

/** Строит объект ребра React Flow из source/target/operator. */
export function buildEdge(
    id: string,
    source: string,
    target: string,
    operator: GraphOperator,
): Edge {
    const color = OPERATOR_COLOR[operator]
    return {
        id,
        source,
        target,
        label: OPERATOR_SYMBOL[operator],
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
        style: { stroke: color, strokeWidth: 2 },
        labelStyle: { fill: color, fontWeight: 700, fontSize: 13 },
        labelBgStyle: { fill: 'var(--surface-card)', fillOpacity: 0.9 },
        labelBgPadding: [6, 3],
        labelBgBorderRadius: 6,
        // operator кладём в data, чтобы инспектор/onConnect могли его читать.
        data: { operator },
    }
}

/** BusinessGraph → { nodes, edges } для React Flow. */
export function mapToFlow(graph: BusinessGraph): { nodes: FlowNode[]; edges: Edge[] } {
    const nodes: FlowNode[] = graph.nodes.map((n) => ({
        id: n.id,
        type: 'indicator',
        position: n.position ?? { x: 0, y: 0 },
        data: {
            indicator: n.indicator,
            unit: n.unit,
            currentValue: n.currentValue,
            isDerived: n.isDerived,
        },
    }))

    const edges: Edge[] = graph.edges.map((e) => buildEdge(e.id, e.source, e.target, e.operator))

    return { nodes, edges }
}
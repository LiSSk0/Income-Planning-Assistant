import type { Edge } from '@xyflow/react'
import type { GraphOperator } from '@/shared/lib/api-types'
import {
    OPERATOR_SYMBOL,
    isOperationNode,
    asOperationData,
    asIndicatorData,
    type GraphNodeUnion,
} from './mapToFlow'

export interface FormulaDef {
    targetId: string
    target: string
    expression: string
    operands: { sourceId: string; source: string; operator: GraphOperator }[]
}

export interface GraphFormulasPayload {
    formulas: FormulaDef[]
    nodes: {
        id: string
        kind: 'indicator' | 'operation'
        label: string
        indicator?: string
        unit?: string
        currentValue?: number
        isDerived?: boolean
        positionX?: number
        positionY?: number
    }[]
    edges: { source: string; target: string; operator: GraphOperator }[]
}

const opOf = (e: Edge): GraphOperator => (e.data?.operator as GraphOperator) ?? '+'

function nodeLabel(n: GraphNodeUnion): string {
    return isOperationNode(n)
        ? OPERATOR_SYMBOL[asOperationData(n).operator]
        : asIndicatorData(n).indicator
}

function expressionForSource(
    sourceId: string,
    byId: Map<string, GraphNodeUnion>,
    incomingByTarget: Map<string, Edge[]>,
    seen: Set<string>,
): string {
    const node = byId.get(sourceId)
    if (!node) return sourceId
    if (!isOperationNode(node)) return asIndicatorData(node).indicator

    const opData = asOperationData(node)
    const opSym = OPERATOR_SYMBOL[opData.operator]
    if (seen.has(sourceId)) return opSym
    seen.add(sourceId)

    const incoming = incomingByTarget.get(sourceId) ?? []
    const parts = incoming.map((e) =>
        expressionForSource(e.source, byId, incomingByTarget, seen),
    )
    seen.delete(sourceId)
    if (parts.length === 0) return opSym
    const joined = parts.join(` ${opSym} `)
    return parts.length > 1 ? `(${joined})` : joined
}

function buildIncomingMap(edges: Edge[]): Map<string, Edge[]> {
    const incomingByTarget = new Map<string, Edge[]>()
    for (const e of edges) {
        const list = incomingByTarget.get(e.target) ?? []
        list.push(e)
        incomingByTarget.set(e.target, list)
    }
    return incomingByTarget
}

export function expandSource(
    sourceId: string,
    nodes: GraphNodeUnion[],
    edges: Edge[],
): string {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    return expressionForSource(sourceId, byId, buildIncomingMap(edges), new Set())
}

function getCleanIndicatorName(node: GraphNodeUnion): string {
    if (isOperationNode(node)) {
        return asOperationData(node).operator
    }
    const indicator = asIndicatorData(node).indicator
    if (indicator) return indicator
    const id = node.id
    let name = id.replace(/^ind-/, '')
    name = name.replace(/-\d+$/, '')
    return name
}

export function buildGraphFormulas(
    nodes: GraphNodeUnion[],
    edges: Edge[],
): GraphFormulasPayload {
    const byId = new Map(nodes.map((n) => [n.id, n]))
    const incomingByTarget = buildIncomingMap(edges)

    const formulas: FormulaDef[] = []
    for (const node of nodes) {
        if (isOperationNode(node)) continue
        const incoming = incomingByTarget.get(node.id) ?? []
        if (incoming.length === 0) continue

        const parts: string[] = []
        const operands: FormulaDef['operands'] = []
        incoming.forEach((e, i) => {
            if (i > 0) parts.push(OPERATOR_SYMBOL[opOf(e)])
            parts.push(expressionForSource(e.source, byId, incomingByTarget, new Set()))
            const src = byId.get(e.source)
            operands.push({
                sourceId: e.source,
                source: src ? nodeLabel(src) : e.source,
                operator: opOf(e),
            })
        })

        const targetName = asIndicatorData(node).indicator
        formulas.push({
            targetId: node.id,
            target: targetName,
            expression: `${targetName} = ${parts.join(' ')}`,
            operands,
        })
    }

    const payloadNodes = nodes.map((n) => ({
        id: n.id,
        kind: (n.kind as 'indicator' | 'operation') || (isOperationNode(n) ? 'operation' : 'indicator'),
        label: getCleanIndicatorName(n),
        indicator: isOperationNode(n) ? undefined : asIndicatorData(n).indicator,
        unit: isOperationNode(n) ? undefined : asIndicatorData(n).unit,
        currentValue: isOperationNode(n) ? undefined : asIndicatorData(n).currentValue,
        isDerived: isOperationNode(n) ? undefined : asIndicatorData(n).isDerived,
        positionX: n.position.x,
        positionY: n.position.y,
    }))

    return {
        formulas,
        nodes: payloadNodes,
        edges: edges.map((e) => ({ source: e.source, target: e.target, operator: opOf(e) })),
    }
}
import { create } from 'zustand'
import type { Edge } from '@xyflow/react'
import type { GraphNodeUnion } from '../lib/mapToFlow'

const GRAPH_STORAGE_KEY = 'sber_graph_state'
const GRAPH_VIEWED_KEY = 'sber_graph_viewed'

type GraphNode = GraphNodeUnion

interface GraphState {
    currentNodes: GraphNode[] | null
    currentEdges: Edge[] | null
    savedNodes: GraphNode[] | null
    savedEdges: Edge[] | null
    hasSaved: boolean
    graphViewed: boolean

    setGraph: (nodes: GraphNode[], edges: Edge[]) => void
    save: (nodes: GraphNode[], edges: Edge[]) => void
    markViewed: () => void
    reset: () => void
    clear: () => void
    loadFromStorage: () => { nodes: GraphNode[] | null; edges: Edge[] | null } | null
    saveToCache: () => void
}

export const useGraphStore = create<GraphState>((set, get) => ({
    currentNodes: null,
    currentEdges: null,
    savedNodes: null,
    savedEdges: null,
    hasSaved: false,
    graphViewed: localStorage.getItem(GRAPH_VIEWED_KEY) === 'true',

    setGraph: (nodes, edges) => {
        const data = {
            nodes: nodes.map((n) => ({ ...n, position: { ...n.position } })),
            edges: edges.map((e) => ({ ...e })),
        }
        localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(data))
        set({
            currentNodes: data.nodes,
            currentEdges: data.edges,
            savedNodes: data.nodes,
            savedEdges: data.edges,
            hasSaved: true,
        })
    },

    save: (nodes, edges) => {
        const data = {
            nodes: nodes.map((n) => ({ ...n, position: { ...n.position } })),
            edges: edges.map((e) => ({ ...e })),
        }
        localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(data))
        set({
            currentNodes: data.nodes,
            currentEdges: data.edges,
            savedNodes: data.nodes,
            savedEdges: data.edges,
            hasSaved: true,
        })
    },

    markViewed: () => {
        localStorage.setItem(GRAPH_VIEWED_KEY, 'true')
        set({ graphViewed: true })
    },

    loadFromStorage: () => {
        const saved = localStorage.getItem(GRAPH_STORAGE_KEY)
        if (saved) {
            try {
                const parsed = JSON.parse(saved)
                if (parsed.nodes && parsed.nodes.length > 0) {
                    set({
                        currentNodes: parsed.nodes,
                        currentEdges: parsed.edges || [],
                        savedNodes: parsed.nodes,
                        savedEdges: parsed.edges || [],
                        hasSaved: true,
                    })
                    return { nodes: parsed.nodes, edges: parsed.edges || [] }
                }
            } catch (e) {
                console.warn('Ошибка загрузки графа из localStorage:', e)
            }
        }
        return null
    },

    saveToCache: () => {
        const { currentNodes, currentEdges } = get()
        if (currentNodes && currentEdges) {
            const data = {
                nodes: currentNodes.map((n) => ({ ...n, position: { ...n.position } })),
                edges: currentEdges.map((e) => ({ ...e })),
            }
            localStorage.setItem(GRAPH_STORAGE_KEY, JSON.stringify(data))
        }
    },

    reset: () => {
        localStorage.removeItem(GRAPH_STORAGE_KEY)
        set({
            currentNodes: null,
            currentEdges: null,
            savedNodes: null,
            savedEdges: null,
            hasSaved: false,
        })
    },

    clear: () => {
        localStorage.removeItem(GRAPH_STORAGE_KEY)
        localStorage.removeItem(GRAPH_VIEWED_KEY)
        set({
            currentNodes: null,
            currentEdges: null,
            savedNodes: null,
            savedEdges: null,
            hasSaved: false,
            graphViewed: false,
        })
    },
}))
// src/domains/ai-insights/store/useNewsStore.ts
import { create } from 'zustand'
import { api } from '@/shared/lib/api'
import type { AnomalyCard, NewsCard } from '@/shared/lib/api-types'

export type NewsPhase =
    | 'IDLE'
    | 'CONNECTING'
    | 'START'
    | 'INDICATORS'
    | 'PARSED'
    | 'FOUND'
    | 'ANALYZING'
    | 'DONE'
    | 'ERROR'

interface NewsState {
    news: NewsCard[]
    anomalies: AnomalyCard[]
    loadingNews: boolean
    loadingAnomalies: boolean
    refreshing: boolean
    error: string | null
    showAnomalies: boolean
    lastFetchedAnomalies: number | null
    newsPhase: NewsPhase
    newsPhaseMessage: string
    lastFetchParams: { subject: string; count: number } | null

    fetchNews: (region?: string, count?: number, force?: boolean) => void
    fetchAnomalies: (subject?: string, threshold?: number, force?: boolean) => Promise<void>
    refreshAll: (region?: string, subject?: string, threshold?: number) => void
    toggleShowAnomalies: () => void
    clear: () => void
    clearCache: () => void
}

const CACHE_TTL = 2 * 60 * 1000

let activeWs: WebSocket | null = null
let pendingRequest: { subject: string; count: number } | null = null
let requestId = 0

function buildWsUrl(): string {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return protocol + '//' + window.location.host + '/ws/news'
}

export const useNewsStore = create<NewsState>((set, get) => ({
    news: [],
    anomalies: [],
    loadingNews: false,
    loadingAnomalies: false,
    refreshing: false,
    error: null,
    showAnomalies: true,
    lastFetchedAnomalies: null,
    newsPhase: 'IDLE' as NewsPhase,
    newsPhaseMessage: '',
    lastFetchParams: null,

    fetchNews: (region, count = 5, force = false) => {
        const subject = region || ''
        const params = { subject, count }

        // Проверяем кеш в sessionStorage
        const cacheKey = `news_ws_${subject}|${count}`
        if (!force) {
            const cached = sessionStorage.getItem(cacheKey)
            if (cached) {
                try {
                    const { data, timestamp } = JSON.parse(cached)
                    if (Date.now() - timestamp < CACHE_TTL && data && data.length > 0) {
                        set({
                            news: data,
                            loadingNews: false,
                            newsPhase: 'DONE',
                            newsPhaseMessage: `Загружено ${data.length} новостей (кеш)`,
                            error: null,
                        })
                        return
                    }
                } catch (e) { /* ignore */ }
            }
        }

        // Если уже идёт загрузка с такими же параметрами — не дублируем
        if (pendingRequest &&
            pendingRequest.subject === params.subject &&
            pendingRequest.count === params.count) {
            return
        }
        pendingRequest = params

        if (activeWs) {
            try { activeWs.close() } catch { /* noop */ }
            activeWs = null
        }

        const reqId = ++requestId

        set({
            loadingNews: true,
            error: null,
            newsPhase: 'CONNECTING' as NewsPhase,
            newsPhaseMessage: 'Подключение к серверу…',
        })

        try {
            const ws = new WebSocket(buildWsUrl())
            activeWs = ws

            ws.onopen = () => {
                ws.send(JSON.stringify({ subject, count }))
                set({
                    newsPhase: 'START' as NewsPhase,
                    newsPhaseMessage: 'Начинаем сбор новостей…',
                })
            }

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data)
                    if (msg.requestId && msg.requestId !== reqId) {
                        return
                    }
                    handleWsPhase(msg, ws, set, subject, count, reqId)
                } catch (err) {
                    console.error('WS parse error:', err)
                }
            }

            ws.onerror = () => {
                activeWs = null
                pendingRequest = null
                set({
                    newsPhase: 'START' as NewsPhase,
                    newsPhaseMessage: 'Загрузка через API…',
                })
                fetchNewsRest(subject, count)
            }

            ws.onclose = () => {
                activeWs = null
                pendingRequest = null
                const { newsPhase } = get()
                if (newsPhase !== 'DONE' && newsPhase !== 'ERROR' && newsPhase !== 'IDLE') {
                    fetchNewsRest(subject, count)
                }
            }
        } catch {
            pendingRequest = null
            fetchNewsRest(subject, count)
        }
    },

    fetchAnomalies: async (subject, threshold = 2.0, force = false) => {
        const { lastFetchedAnomalies, anomalies } = get()
        const cacheKey = (subject || 'all') + '|' + threshold

        if (!force && lastFetchedAnomalies && Date.now() - lastFetchedAnomalies < CACHE_TTL && anomalies.length > 0) {
            return
        }

        set({ loadingAnomalies: true, error: null })
        try {
            const data = await api.getAnomalies(subject, undefined, threshold)
            sessionStorage.setItem('anomalies_' + cacheKey, JSON.stringify(data))
            set({ anomalies: data, loadingAnomalies: false, lastFetchedAnomalies: Date.now() })
        } catch (e) {
            const cached = sessionStorage.getItem('anomalies_' + cacheKey)
            if (cached) {
                try {
                    set({ anomalies: JSON.parse(cached), loadingAnomalies: false })
                    return
                } catch { /* noop */ }
            }
            set({
                loadingAnomalies: false,
                error: e instanceof Error ? e.message : 'Ошибка загрузки аномалий',
            })
        }
    },

    refreshAll: (region, subject, threshold = 2.0) => {
        set({ refreshing: true, error: null })
        get().fetchNews(region, 5, true)
        get().fetchAnomalies(subject, threshold, true).finally(() => {
            set({ refreshing: false })
        })
    },

    toggleShowAnomalies: () => set((s) => ({ showAnomalies: !s.showAnomalies })),

    clear: () => set({
        news: [],
        anomalies: [],
        loadingNews: false,
        loadingAnomalies: false,
        refreshing: false,
        error: null,
        showAnomalies: true,
        lastFetchedAnomalies: null,
        newsPhase: 'IDLE' as NewsPhase,
        newsPhaseMessage: '',
        lastFetchParams: null,
    }),

    clearCache: () => {
        set({
            news: [],
            anomalies: [],
            loadingNews: false,
            loadingAnomalies: false,
            refreshing: false,
            error: null,
            newsPhase: 'IDLE' as NewsPhase,
            newsPhaseMessage: '',
            lastFetchParams: null,
        })
        const keys = Object.keys(sessionStorage)
        for (const key of keys) {
            if (key.startsWith('news_') || key.startsWith('anomalies_')) {
                sessionStorage.removeItem(key)
            }
        }
        if (activeWs) {
            try { activeWs.close() } catch { /* noop */ }
            activeWs = null
        }
        pendingRequest = null
    },
}))

/* ---------- helpers ---------- */

function mapRawToCards(raw: any[]): NewsCard[] {
    return raw.map((n: any, i: number) => ({
        id: n.id || 'news-' + Date.now() + '-' + i,
        title: n.title || 'Новость',
        summary: n.summary || '',
        source: n.source || 'Источник',
        date: n.date || '',
        url: n.url || '',
        impact: (['positive', 'negative', 'neutral'].includes(n.impact)
            ? n.impact : 'neutral') as NewsCard['impact'],
        presumed: n.presumed ?? true,
        relatedPeriod: n.relatedPeriod || undefined,
    }))
}

function handleWsPhase(
    msg: any,
    ws: WebSocket,
    set: (s: Partial<NewsState>) => void,
    subject: string,
    count: number,
    reqId: number,
) {
    const phase = msg.phase as string

    if (['START', 'INDICATORS', 'PARSED', 'FOUND', 'ANALYZING'].includes(phase)) {
        set({ newsPhase: phase as NewsPhase, newsPhaseMessage: msg.message || '' })
        return
    }

    if (phase === 'DONE') {
        const cards = mapRawToCards(msg.data || [])
        set({
            news: cards,
            loadingNews: false,
            newsPhase: 'DONE',
            newsPhaseMessage: msg.message || `Загружено ${cards.length} новостей`,
            error: cards.length === 0 ? 'Новостей не найдено' : null,
        })
        try {
            sessionStorage.setItem(
                `news_ws_${subject}|${count}`,
                JSON.stringify({ data: cards, timestamp: Date.now() })
            )
        } catch { /* quota */ }
        ws.close()
        activeWs = null
        pendingRequest = null
        return
    }

    if (phase === 'ERROR') {
        set({
            loadingNews: false,
            newsPhase: 'ERROR',
            newsPhaseMessage: msg.message || 'Ошибка',
            error: msg.message || 'Ошибка загрузки новостей',
        })
        ws.close()
        activeWs = null
        pendingRequest = null
    }
}

async function fetchNewsRest(subject?: string, count: number = 5) {
    const set = useNewsStore.setState
    try {
        const data = await api.getNews(subject)
        const cards = mapRawToCards(data).slice(0, count)
        set({
            news: cards,
            loadingNews: false,
            newsPhase: 'DONE' as NewsPhase,
            newsPhaseMessage: `Загружено ${cards.length} новостей`,
            error: cards.length === 0 ? 'Новостей не найдено' : null,
        })
        sessionStorage.setItem(
            `news_ws_${subject || ''}|${count}`,
            JSON.stringify({ data: cards, timestamp: Date.now() })
        )
        pendingRequest = null
    } catch (e) {
        const cached = sessionStorage.getItem(`news_ws_${subject || ''}|${count}`)
        if (cached) {
            try {
                const { data } = JSON.parse(cached)
                set({
                    news: data,
                    loadingNews: false,
                    newsPhase: 'DONE' as NewsPhase,
                    newsPhaseMessage: 'Кешированные данные',
                    error: 'Сервер недоступен, показаны кешированные данные',
                })
                pendingRequest = null
                return
            } catch { /* noop */ }
        }
        set({
            loadingNews: false,
            newsPhase: 'ERROR' as NewsPhase,
            newsPhaseMessage: 'Ошибка загрузки',
            error: e instanceof Error ? e.message : 'Ошибка загрузки новостей',
        })
        pendingRequest = null
    }
}
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

    fetchNews: (subject?: string, period?: number) => void
    fetchAnomalies: (subject?: string, threshold?: number, force?: boolean) => Promise<void>
    refreshAll: (subject?: string, period?: number, threshold?: number) => void
    toggleShowAnomalies: () => void
    clear: () => void
}

const CACHE_TTL = 5 * 60 * 1000

let activeWs: WebSocket | null = null

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

    fetchNews: (subject, period = 90) => {
        if (activeWs) {
            try { activeWs.close() } catch { /* noop */ }
            activeWs = null
        }

        set({
            loadingNews: true,
            error: null,
            newsPhase: 'CONNECTING' as NewsPhase,
            newsPhaseMessage: '\u041f\u043e\u0434\u043a\u043b\u044e\u0447\u0435\u043d\u0438\u0435 \u043a \u0441\u0435\u0440\u0432\u0435\u0440\u0443\u2026',
        })

        try {
            const ws = new WebSocket(buildWsUrl())
            activeWs = ws

            ws.onopen = () => {
                ws.send(JSON.stringify({ subject: subject || '', period }))
                set({
                    newsPhase: 'START' as NewsPhase,
                    newsPhaseMessage: '\u041d\u0430\u0447\u0438\u043d\u0430\u0435\u043c \u0441\u0431\u043e\u0440 \u043d\u043e\u0432\u043e\u0441\u0442\u0435\u0439\u2026',
                })
            }

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data)
                    handleWsPhase(msg, ws, set, subject, period)
                } catch (err) {
                    console.error('WS parse error:', err)
                }
            }

            ws.onerror = () => {
                activeWs = null
                set({
                    newsPhase: 'START' as NewsPhase,
                    newsPhaseMessage: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0447\u0435\u0440\u0435\u0437 API\u2026',
                })
                fetchNewsRest(subject, period)
            }

            ws.onclose = () => {
                activeWs = null
                const { newsPhase } = get()
                if (newsPhase !== 'DONE' && newsPhase !== 'ERROR' && newsPhase !== 'IDLE') {
                    fetchNewsRest(subject, period)
                }
            }
        } catch {
            fetchNewsRest(subject, period)
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
                error: e instanceof Error ? e.message : '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u0430\u043d\u043e\u043c\u0430\u043b\u0438\u0439',
            })
        }
    },

    refreshAll: (subject, period = 90, threshold = 2.0) => {
        set({ refreshing: true, error: null })
        get().fetchNews(subject, period)
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
    }),
}))

/* ---------- helpers ---------- */

function mapRawToCards(raw: any[]): NewsCard[] {
    return raw.map((n: any, i: number) => ({
        id: n.id || 'news-' + Date.now() + '-' + i,
        title: n.title || '\u041d\u043e\u0432\u043e\u0441\u0442\u044c',
        summary: n.summary || '',
        source: n.source || '\u0418\u0441\u0442\u043e\u0447\u043d\u0438\u043a',
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
    subject: string | undefined,
    period: number,
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
            newsPhaseMessage: msg.message || '\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e ' + cards.length + ' \u043d\u043e\u0432\u043e\u0441\u0442\u0435\u0439',
            error: cards.length === 0 ? '\u041d\u043e\u0432\u043e\u0441\u0442\u0435\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e' : null,
        })
        try {
            sessionStorage.setItem(
                'news_ws_' + (subject || 'all') + '|' + period,
                JSON.stringify(cards),
            )
        } catch { /* quota */ }
        ws.close()
        activeWs = null
        return
    }

    if (phase === 'ERROR') {
        set({
            loadingNews: false,
            newsPhase: 'ERROR',
            newsPhaseMessage: msg.message || '\u041e\u0448\u0438\u0431\u043a\u0430',
            error: msg.message || '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u043d\u043e\u0432\u043e\u0441\u0442\u0435\u0439',
        })
        ws.close()
        activeWs = null
    }
}

async function fetchNewsRest(subject?: string, period: number = 90) {
    const set = useNewsStore.setState
    try {
        const data = await api.getNews(subject, period)
        const cards = mapRawToCards(data)
        set({
            news: cards,
            loadingNews: false,
            newsPhase: 'DONE' as NewsPhase,
            newsPhaseMessage: '\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e ' + cards.length + ' \u043d\u043e\u0432\u043e\u0441\u0442\u0435\u0439',
            error: cards.length === 0 ? '\u041d\u043e\u0432\u043e\u0441\u0442\u0435\u0439 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u043e' : null,
        })
    } catch (e) {
        const cached = sessionStorage.getItem('news_ws_' + (subject || 'all') + '|' + period)
        if (cached) {
            try {
                set({
                    news: JSON.parse(cached),
                    loadingNews: false,
                    newsPhase: 'DONE' as NewsPhase,
                    newsPhaseMessage: '\u041a\u0435\u0448\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435',
                    error: '\u0421\u0435\u0440\u0432\u0435\u0440 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d, \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u044b \u043a\u0435\u0448\u0438\u0440\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u0434\u0430\u043d\u043d\u044b\u0435',
                })
                return
            } catch { /* noop */ }
        }
        set({
            loadingNews: false,
            newsPhase: 'ERROR' as NewsPhase,
            newsPhaseMessage: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438',
            error: e instanceof Error ? e.message : '\u041e\u0448\u0438\u0431\u043a\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0438 \u043d\u043e\u0432\u043e\u0441\u0442\u0435\u0439',
        })
    }
}

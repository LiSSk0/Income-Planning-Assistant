import { useEffect, useRef, useState } from 'react'
import { Newspaper, Sparkles, Loader2 } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, CardTitle, Skeleton } from '@/shared/ui'
import { api } from '@/shared/lib/api'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import type { AiSummaryResponse } from '@/shared/lib/api-types'

/* Блок 3 (task_week1): AI-виджет.
   - marketNews подгружается АВТОМАТИЧЕСКИ при выборе региона.
   - aiPlanSummary показывается по кнопке «Сгенерировать AI-резюме планов»
     с эффектом печатающегося текста. */

interface Props {
  subject: string
}

/** Хук эффекта «печатающегося текста». Уважает prefers-reduced-motion
 *  (там текст появляется сразу целиком). */
function useTypewriter(text: string, enabled: boolean, speed = 14) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState('')
  const timer = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    clearInterval(timer.current)
    if (!enabled || !text) {
      setShown('')
      return
    }
    if (reduced) {
      setShown(text)
      return
    }
    let i = 0
    timer.current = setInterval(() => {
      i++
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(timer.current)
    }, speed)
    return () => clearInterval(timer.current)
  }, [text, enabled, reduced, speed])

  return shown
}

export function AiWidget({ subject }: Props) {
  const [data, setData] = useState<AiSummaryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summaryRequested, setSummaryRequested] = useState(false)

  // Автозагрузка контекстных подсказок при смене региона.
  useEffect(() => {
    let alive = true
    setLoading(true)
    setError(null)
    setSummaryRequested(false)
    api
      .getAiSummary(subject)
      .then((res) => {
        if (alive) setData(res)
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'AI-подсказки недоступны.')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [subject])

  const typed = useTypewriter(data?.aiPlanSummary ?? '', summaryRequested)
  const isTyping =
    summaryRequested && !!data && typed.length < (data.aiPlanSummary?.length ?? 0)

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-accent-lime" />
        <CardTitle className="text-accent-lime">AI-помощник</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-1 flex-col gap-4">
        {/* Контекстные подсказки по рынку (автозагрузка) */}
        <div>
          <div className="mb-2 flex items-center gap-1.5 text-xs uppercase tracking-wide text-text-secondary">
            <Newspaper className="h-3.5 w-3.5" />
            Контекст по рынку
          </div>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
            </div>
          ) : error ? (
            <p className="text-sm text-accent-red">{error}</p>
          ) : (
            <p className="rounded-lg border border-border bg-bg-elevated p-3 text-sm leading-relaxed text-text-primary">
              {data?.marketNews}
            </p>
          )}
        </div>

        {/* AI-резюме планов (по кнопке, с печатающимся текстом) */}
        <div className="flex flex-1 flex-col">
          <div className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
            Резюме планов
          </div>

          {summaryRequested ? (
            <p className="min-h-[96px] flex-1 rounded-lg border border-accent-lime/20 bg-accent-lime/5 p-3 text-sm leading-relaxed text-text-primary">
              {typed}
              {isTyping && (
                <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-accent-lime align-middle" />
              )}
            </p>
          ) : (
            <Button
              onClick={() => setSummaryRequested(true)}
              disabled={loading || !!error}
              className="self-start"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Сгенерировать AI-резюме планов
            </Button>
          )}
        </div>
      </CardBody>
    </Card>
  )
}

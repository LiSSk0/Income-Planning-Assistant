import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Newspaper, AlertTriangle } from 'lucide-react'
import { Card, CardBody, Skeleton, EmptyState } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { api } from '@/shared/lib/api'
import type { AnomalyCard, NewsCard } from '@/shared/lib/api-types'
import { AnomalyCardItem } from './components/AnomalyCardItem'
import { NewsCardItem } from './components/NewsCardItem'

/* AI-аналитика: две колонки — Новости и Аномалии. */
export function AiInsightsPage() {
  const reduced = usePrefersReducedMotion()

  const [news, setNews] = useState<NewsCard[]>([])
  const [anomalies, setAnomalies] = useState<AnomalyCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    Promise.all([api.getNews(), api.getAnomalies()])
      .then(([n, a]) => {
        if (!active) return
        setNews(n)
        setAnomalies(a)
      })
      .catch((e) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Не удалось загрузить новости и аномалии.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const motionProps = (i: number) =>
    reduced
      ? {}
      : {
          initial: { opacity: 0, y: 8 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.25, delay: i * 0.05 },
        }

  return (
    <div>
      <PageHeader
        title="AI-аналитика"
        subtitle="Внешние новости и автоматически найденные аномалии по доходу и показателям."
      />

      {error ? (
        <Card className="mt-4">
          <CardBody className="pt-5">
            <EmptyState
              icon={<AlertTriangle className="h-8 w-8" />}
              title="Данные AI-панели недоступны"
              description={error}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Колонка 1: Новости */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-text-primary">
              <Newspaper className="h-4 w-4 text-text-secondary" />
              Новости ({news.length})
            </h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-32 w-full" />
                ))}
              </div>
            ) : news.length ? (
              <div className="space-y-3">
                {news.map((n, i) => (
                  <motion.div key={n.id} {...motionProps(i)}>
                    <NewsCardItem news={n} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card>
                <CardBody className="pt-5">
                  <EmptyState
                    icon={<Newspaper className="h-8 w-8" />}
                    title="Новостей нет"
                    description="Связанных с показателем новостей за период не нашлось."
                  />
                </CardBody>
              </Card>
            )}
          </div>

          {/* Колонка 2: Аномалии */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-wide text-text-primary">
              <AlertTriangle className="h-4 w-4 text-text-secondary" />
              Аномалии ({anomalies.length})
            </h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 w-full" />
                ))}
              </div>
            ) : anomalies.length ? (
              <div className="space-y-3">
                {anomalies.map((a, i) => (
                  <motion.div key={a.id} {...motionProps(i)}>
                    <AnomalyCardItem anomaly={a} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card>
                <CardBody className="pt-5">
                  <EmptyState
                    icon={<AlertTriangle className="h-8 w-8" />}
                    title="Аномалий не найдено"
                    description="За наблюдаемый период существенных отклонений (>12%) не зафиксировано."
                  />
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

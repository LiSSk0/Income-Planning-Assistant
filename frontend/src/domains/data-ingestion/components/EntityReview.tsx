import { useEffect, useState, type ReactNode } from 'react'
import {
  Calendar,
  TrendingUp,
  MapPin,
  Hash,
  Ruler,
  AlertCircle,
} from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle, Tag, Select, Skeleton, EmptyState } from '@/shared/ui'
import { api } from '@/shared/lib/api'
import type { DetectedEntity, EntityCategory } from '@/shared/lib/api-types'
import { formatNumber } from '@/shared/lib/format'

type Tone = 'lime' | 'green' | 'blue' | 'amber' | 'red' | 'neutral'

interface CategoryMeta {
  label: string
  tone: Tone
  icon: ReactNode
}

const CATEGORY_META: Record<EntityCategory, CategoryMeta> = {
  date: { label: 'Дата', tone: 'blue', icon: <Calendar className="h-3.5 w-3.5" /> },
  indicator: { label: 'Показатель', tone: 'lime', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  territory: { label: 'Территория', tone: 'green', icon: <MapPin className="h-3.5 w-3.5" /> },
  value: { label: 'Значение', tone: 'amber', icon: <Hash className="h-3.5 w-3.5" /> },
  unit: { label: 'Мера', tone: 'neutral', icon: <Ruler className="h-3.5 w-3.5" /> },
}

const CATEGORY_ORDER: EntityCategory[] = ['date', 'territory', 'indicator', 'unit', 'value']

interface Props {
  /** Коллбэк наружу: актуальная разметка колонок (для кнопки «Подтвердить»). */
  onChange?: (mapping: DetectedEntity[]) => void
}

export function EntityReview({ onChange }: Props) {
  const [entities, setEntities] = useState<DetectedEntity[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .getEntities()
      .then((data) => {
        if (alive) setEntities(data)
      })
      .catch(() => {
        if (alive) setError('Не удалось получить результат автоопределения сущностей.')
      })
    return () => {
      alive = false
    }
  }, [])

  function setCategory(column: string, category: EntityCategory) {
    setEntities((prev) => {
      if (!prev) return prev
      // Ручная коррекция = достоверность 100%.
      const next = prev.map((e) =>
        e.column === column ? { ...e, category, confidence: 1 } : e,
      )
      onChange?.(next)
      return next
    })
  }

  if (error) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={<AlertCircle className="h-8 w-8" />}
            title="Автоопределение недоступно"
            description={error}
          />
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle>Автоопределение сущностей</CardTitle>
        <span className="text-xs text-text-secondary">
          Проверьте категорию каждой колонки и при необходимости скорректируйте
        </span>
      </CardHeader>
      <CardBody>
        {!entities ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <ul className="space-y-2">
            {entities.map((e) => {
              const meta = CATEGORY_META[e.category]
              const confPct = Math.round(e.confidence * 100)
              const lowConfidence = e.confidence < 0.7
              return (
                <li
                  key={e.column}
                  className="flex flex-col gap-3 rounded-card border border-border bg-bg-elevated/40 px-4 py-3 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium text-text-primary">{e.column}</span>
                      <Tag tone={meta.tone}>
                        {meta.icon}
                        {meta.label}
                      </Tag>
                      <span
                        className={
                          lowConfidence
                            ? 'tabular text-xs text-accent-amber'
                            : 'tabular text-xs text-text-muted'
                        }
                        title="Достоверность автоопределения"
                      >
                        {confPct}%
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-text-muted">
                      Примеры: {e.sample.map((s) => formatSample(s)).join(', ')}
                    </p>
                  </div>

                  <div className="w-full md:w-52">
                    <Select
                      aria-label={`Категория колонки ${e.column}`}
                      value={e.category}
                      onChange={(ev) => setCategory(e.column, ev.target.value as EntityCategory)}
                    >
                      {CATEGORY_ORDER.map((cat) => (
                        <option key={cat} value={cat}>
                          {CATEGORY_META[cat].label}
                        </option>
                      ))}
                    </Select>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}

/** Числовые сэмплы группируем по-русски, остальное — как есть. */
function formatSample(s: string): string {
  const n = Number(s)
  return s !== '' && Number.isFinite(n) && /^-?\d+(\.\d+)?$/.test(s) ? formatNumber(n) : s
}

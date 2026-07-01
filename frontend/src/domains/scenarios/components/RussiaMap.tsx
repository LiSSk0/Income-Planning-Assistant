import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { MapPin } from 'lucide-react'
import { Card, CardBody, CardHeader, CardTitle, EmptyState } from '@/shared/ui'
import { formatNumber } from '@/shared/lib/format'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import type { Scenario, ScenarioRegionValue } from '@/shared/lib/api-types'

/* Картограмма регионов РФ по значению целевого показателя выбранного
   сценария. Для надёжности офлайн (без сетевого GeoJSON и проблем
   совпадения названий субъектов) используем плиточную картограмму
   (tile cartogram): по плитке на субъект, интенсивность заливки
   accent-green ∝ значению. При смене сценария fill плавно
   перекрашивается (framer-motion), с учётом prefers-reduced-motion. */

interface Props {
  scenario?: Scenario
}

const ACCENT = '#21A038' // accent-green — для интерполяции SVG-fill

/** Линейная интерполяция прозрачности по нормированному значению. */
function fillFor(value: number, min: number, max: number): string {
  const t = max > min ? (value - min) / (max - min) : 1
  const opacity = 0.18 + t * 0.72 // 0.18..0.9
  return hexToRgba(ACCENT, +opacity.toFixed(3))
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export function RussiaMap({ scenario }: Props) {
  const reduced = usePrefersReducedMotion()

  const regions: ScenarioRegionValue[] = useMemo(
    () => [...(scenario?.byRegion ?? [])].sort((a, b) => b.value - a.value),
    [scenario],
  )

  const { min, max } = useMemo(() => {
    const vals = regions.map((r) => r.value)
    return { min: Math.min(...vals, 0), max: Math.max(...vals, 1) }
  }, [regions])

  if (!scenario || regions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Карта регионов РФ</CardTitle>
        </CardHeader>
        <CardBody>
          <EmptyState
            icon={<MapPin className="h-8 w-8" />}
            title="Нет данных по регионам"
            description="Выберите готовый сценарий, чтобы увидеть распределение целевого показателя по субъектам РФ."
          />
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-2">
        <CardTitle>Карта регионов РФ — {scenario.title}</CardTitle>
        <span className="text-xs text-text-secondary">{scenario.params.targetIndicator}</span>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {regions.map((r) => (
            <motion.div
              key={r.subject}
              className="relative overflow-hidden rounded-card border border-border p-3"
              animate={{ backgroundColor: fillFor(r.value, min, max) }}
              transition={{ duration: reduced ? 0 : 0.6, ease: 'easeOut' }}
            >
              <div className="text-xs font-medium text-text-primary drop-shadow">{r.subject}</div>
              <div className="tabular mt-2 text-base font-semibold text-text-primary drop-shadow">
                {formatNumber(r.value, 0)}
              </div>
              <div className="mt-0.5 text-[11px] text-text-primary/70">руб</div>
            </motion.div>
          ))}
        </div>

        {/* Легенда шкалы */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-secondary">{formatNumber(min, 0)}</span>
          <div
            className="h-2 flex-1 rounded-pill"
            style={{
              background: `linear-gradient(90deg, ${hexToRgba(ACCENT, 0.18)}, ${hexToRgba(ACCENT, 0.9)})`,
            }}
          />
          <span className="text-xs text-text-secondary">{formatNumber(max, 0)}</span>
        </div>
        <p className="text-[11px] text-text-muted">
          Интенсивность заливки пропорциональна значению показателя. Схематичная
          картограмма по субъектам РФ; переключение сценария плавно перекрашивает плитки.
        </p>
      </CardBody>
    </Card>
  )
}

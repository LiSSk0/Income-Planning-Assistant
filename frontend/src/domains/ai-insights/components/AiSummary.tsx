import { useMemo } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardBody } from '@/shared/ui'
import { formatPeriodFull, formatPercent } from '@/shared/lib/format'
import type { AnomalyCard } from '@/shared/lib/api-types'

interface Props {
  anomalies: AnomalyCard[]
}

/** Склонение слова «аномалия» по числу. */
function pluralAnomaly(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'аномалия'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'аномалии'
  return 'аномалий'
}

/** Связный разбор массива аномалий — от лица интерфейса, конкретно. */
export function buildSummary(anomalies: AnomalyCard[]): string {
  if (anomalies.length === 0) {
    return 'Существенных отклонений (>12%) не обнаружено за наблюдаемый период.'
  }

  const ups = anomalies.filter((a) => a.direction === 'up')
  const downs = anomalies.filter((a) => a.direction === 'down')

  const strongestUp = ups.reduce<AnomalyCard | null>(
    (max, a) => (!max || a.deviationPct > max.deviationPct ? a : max),
    null,
  )
  const strongestDown = downs.reduce<AnomalyCard | null>(
    (min, a) => (!min || a.deviationPct < min.deviationPct ? a : min),
    null,
  )

  const parts: string[] = []
  parts.push(
    `Зафиксировано ${anomalies.length} ${pluralAnomaly(anomalies.length)}: ` +
      `${ups.length} на рост и ${downs.length} на спад.`,
  )

  if (strongestUp) {
    parts.push(
      `Самый сильный рост — «${strongestUp.indicator}» в регионе ${strongestUp.subject} ` +
        `(${formatPeriodFull(strongestUp.period)}), ${formatPercent(strongestUp.deviationPct)} к тренду.`,
    )
  }
  if (strongestDown) {
    parts.push(
      `Самый сильный спад — «${strongestDown.indicator}» в регионе ${strongestDown.subject} ` +
        `(${formatPeriodFull(strongestDown.period)}), ${formatPercent(strongestDown.deviationPct)} к тренду.`,
    )
  }

  return parts.join(' ')
}

/** «Резюме по графику» — текстовый разбор отклонений с лаймовым акцентом. */
export function AiSummary({ anomalies }: Props) {
  const text = useMemo(() => buildSummary(anomalies), [anomalies])

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-lime" />
          <h3 className="text-sm font-semibold tracking-wide text-accent-lime">
            Резюме по графику
          </h3>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-text-secondary">{text}</p>
      </CardBody>
    </Card>
  )
}

import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Customized,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardBody, CardHeader, CardTitle, Tag } from '@/shared/ui'
import { chartTheme } from '@/shared/ui/chartTheme'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { YOY } from '@/mocks/yoyStd'

/* Блок «Расчёт СКО для прогнозируемого дохода (YoY)» (info/docum.docx).
   Слева — столбец выбора региона (можно выбрать только один). По выбранному
   региону строится диаграмма: столбцы 2024 (синий), 2025 (красный),
   2026 (зелёный — прогноз) + пунктирная рамка доверительного коридора
   поверх прогнозного столбца. */

const YEAR_COLOR: Record<string, string> = {
  '2024': chartTheme.blue,
  '2025': chartTheme.red,
  '2026': chartTheme.green,
}

type AxisMapEntry = {
  scale: ((v: string | number) => number) & { bandwidth?: () => number }
}

interface ConfidenceBoxProps {
  xAxisMap?: Record<string, AxisMapEntry>
  yAxisMap?: Record<string, AxisMapEntry>
  lower?: number
  upper?: number
  targetKey?: string
}

/* Рисует пунктирную рамку (без заливки) вокруг диапазона [lower, upper]
   поверх столбца targetKey — как на референсной картинке. */
function ConfidenceBox({ xAxisMap, yAxisMap, lower, upper, targetKey }: ConfidenceBoxProps) {
  if (!xAxisMap || !yAxisMap || lower === undefined || upper === undefined) return null

  const xAxis = Object.values(xAxisMap)[0]
  const yAxis = Object.values(yAxisMap)[0]
  if (!xAxis || !yAxis) return null

  const bandwidth = xAxis.scale.bandwidth ? xAxis.scale.bandwidth() : 0
  const xCenter = xAxis.scale(targetKey ?? '') + bandwidth / 2

  // Рамка немного шире самого столбца, как на образце.
  const boxWidth = bandwidth * 0.9
  const yTop = yAxis.scale(upper)
  const yBottom = yAxis.scale(lower)

  return (
    <rect
      x={xCenter - boxWidth / 2}
      y={yTop}
      width={boxWidth}
      height={Math.max(yBottom - yTop, 1)}
      fill="none"
      stroke={chartTheme.textPrimary ?? '#ffffff'}
      strokeWidth={1.5}
      strokeDasharray="5 4"
      rx={2}
    />
  )
}

export function YoYStdChart() {
  const [subject, setSubject] = useState<string>(YOY.regions[0]?.subject ?? '')

  const region = useMemo(
    () => YOY.regions.find((r) => r.subject === subject) ?? YOY.regions[0],
    [subject],
  )

  // Полуинтервал коридора = σ выбранного региона.
  const sigma = region ? Math.round((region.upper - region.lower) / 2) : 0

  const data = useMemo(() => {
    if (!region) return []
    return [
      { year: '2024', value: region.y2024 },
      { year: '2025', value: region.y2025 },
      { year: '2026', value: region.y2026 },
    ]
  }, [region])

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>Расчёт СКО для прогнозируемого дохода (YoY)</CardTitle>
        <div className="flex items-center gap-2">
          <Tag tone="lime">σ = {formatNumber(sigma, 0)} руб</Tag>
          <Tag tone="neutral">доверие {YOY.confidence}%</Tag>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          {/* Левый столбец: выбор региона (только один) */}
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-text-secondary">Регион</p>
            <div className="space-y-1.5">
              {YOY.regions.map((r) => {
                const on = r.subject === subject
                return (
                  <label
                    key={r.subject}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors',
                      on
                        ? 'border-accent-green/50 bg-accent-green/10 text-text-primary'
                        : 'border-border text-text-secondary hover:bg-surface-hover',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-accent-green"
                      checked={on}
                      onChange={() => setSubject(r.subject)}
                    />
                    {r.subject}
                  </label>
                )
              })}
            </div>
          </div>

          {/* Диаграмма по выбранному региону */}
          <div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 24, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="year" {...chartTheme.axis} />
                  <YAxis {...chartTheme.axis} width={72} tickFormatter={(v) => formatNumber(v, 0)} />
                  <Tooltip
                    {...chartTheme.tooltip}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                    formatter={(v: number) => [formatNumber(v, 0) + ' руб', 'Доход']}
                  />
                  <Bar dataKey="value" radius={[3, 3, 0, 0]}>
                    {data.map((d) => (
                      <Cell key={d.year} fill={YEAR_COLOR[d.year]} />
                    ))}
                  </Bar>
                  {/* Пунктирная рамка доверительного коридора поверх столбца 2026 */}
                  {region && (
                    <Customized
                      component={(props: any) => (
                        <ConfidenceBox
                          {...props}
                          lower={region.lower}
                          upper={region.upper}
                          targetKey="2026"
                        />
                      )}
                    />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-3 text-xs text-text-muted">
              {region?.subject}: синий — 2024, красный — 2025, зелёный — прогноз 2026.
              Пунктирная рамка на прогнозе — диапазон реального значения с доверием{' '}
              {YOY.confidence}%.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  )
}
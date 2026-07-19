import { type ReactNode } from 'react'
import { Card } from './Card'
import { AnimatedNumber } from './AnimatedNumber'
import { cn } from '@/shared/lib/cn'
import { formatPercent } from '@/shared/lib/format'

interface Props {
  label: string
  value: number
  unit?: string
  fractionDigits?: number
  deltaPct?: number
  icon?: ReactNode
}

export function KpiStat({ label, value, unit, fractionDigits = 0, deltaPct, icon }: Props) {
  const positive = (deltaPct ?? 0) >= 0
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <span className="text-xs uppercase tracking-wide text-text-secondary">{label}</span>
        {icon && <span className="text-text-muted">{icon}</span>}
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <AnimatedNumber
          value={value}
          fractionDigits={fractionDigits}
          className="tabular text-2xl font-bold text-text-primary"
        />
        {unit && <span className="text-sm text-text-secondary">{unit}</span>}
      </div>
      {deltaPct !== undefined && (
        <div className={cn('mt-1 text-xs tabular', positive ? 'text-accent-green' : 'text-accent-red')}>
          {formatPercent(deltaPct)} к пред. периоду
        </div>
      )}
    </Card>
  )
}

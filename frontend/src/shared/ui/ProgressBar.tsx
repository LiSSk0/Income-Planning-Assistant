import { cn } from '@/shared/lib/cn'

interface Props {
  /** 0..100 */
  percent: number
  label?: string
  className?: string
}

/** Прогресс-бар, привязанный к % обработки (WebSocket-события загрузки). */
export function ProgressBar({ percent, label, className }: Props) {
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-text-secondary">{label}</span>
          <span className="tabular text-text-primary">{Math.round(clamped)}%</span>
        </div>
      )}
      <div
        className="h-2 w-full overflow-hidden rounded-pill bg-white/5"
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full rounded-pill bg-accent-green transition-[width] duration-300 ease-out"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )
}

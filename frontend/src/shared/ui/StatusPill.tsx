import { Tag } from './Tag'
import type { ScenarioStatus } from '@/shared/lib/api-types'

const MAP: Record<ScenarioStatus, { tone: 'neutral' | 'amber' | 'green' | 'red'; label: string }> = {
  queued: { tone: 'neutral', label: 'В очереди' },
  computing: { tone: 'amber', label: 'Считается…' },
  ready: { tone: 'green', label: 'Готов' },
  failed: { tone: 'red', label: 'Ошибка' },
}

/** Явно отражает состояние тяжёлого пересчёта (лимит 5 потоков). */
export function StatusPill({ status }: { status: ScenarioStatus }) {
  const s = MAP[status]
  return (
    <Tag tone={s.tone}>
      {status === 'computing' && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden />
      )}
      {s.label}
    </Tag>
  )
}

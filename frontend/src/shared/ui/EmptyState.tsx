import type { ReactNode } from 'react'

interface Props {
  icon?: ReactNode
  title: string
  /** Конкретно: что произошло и что делать дальше (без общих фраз). */
  description: string
  action?: ReactNode
}

/** Пустое/ошибочное состояние. Текст — от лица интерфейса, без извинений. */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon && <div className="text-text-muted">{icon}</div>}
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="max-w-md text-sm text-text-secondary">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

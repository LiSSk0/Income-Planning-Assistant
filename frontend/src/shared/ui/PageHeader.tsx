import type { ReactNode } from 'react'

interface Props {
  title: string
  subtitle?: string
  actions?: ReactNode
}

/** Единый заголовок экрана. Заголовки — лаймовым акцентом (раздел 2). */
export function PageHeader({ title, subtitle, actions }: Props) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-text-primary md:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-text-secondary">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

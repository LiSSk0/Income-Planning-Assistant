import { cn } from '@/shared/lib/cn'

interface Props {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  id?: string
  disabled?: boolean
}

/** Тумблер (например, «учёт сезонности»). */
export function Toggle({ checked, onChange, label, id, disabled = false }: Props) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2.5 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span
        className={cn(
          'relative h-5 w-10 shrink-0 rounded-pill border transition-colors',
          checked ? 'border-accent-green/40 bg-accent-green/30' : 'border-border bg-white/5',
        )}
      >
        <span
          className={cn(
            'absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-transform',
            checked ? 'translate-x-[18px] bg-accent-green' : 'translate-x-0 bg-text-muted',
          )}
        />
      </span>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </button>
  )
}

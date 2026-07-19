import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

type Tone = 'lime' | 'green' | 'blue' | 'amber' | 'red' | 'neutral'

const tones: Record<Tone, string> = {
  lime: 'bg-accent-lime/15 text-accent-lime border-accent-lime/30',
  green: 'bg-accent-green/15 text-accent-green border-accent-green/30',
  blue: 'bg-accent-blue/15 text-accent-blue border-accent-blue/30',
  amber: 'bg-accent-amber/15 text-accent-amber border-accent-amber/30',
  red: 'bg-accent-red/15 text-accent-red border-accent-red/30',
  neutral: 'bg-white/5 text-text-secondary border-border',
}

interface TagProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

export function Tag({ tone = 'neutral', className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-xs font-medium',
        tones[tone],
        className,
      )}
      {...props}
    />
  )
}

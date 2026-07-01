import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

/** Скелетон загрузки. Анимация шиммера отключается при reduced-motion
 *  (см. медиазапрос в index.css). */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-white/5',
        'after:absolute after:inset-0 after:-translate-x-full',
        'after:bg-gradient-to-r after:from-transparent after:via-white/10 after:to-transparent',
        'after:animate-[shimmer_1.5s_infinite]',
        className,
      )}
      {...props}
    />
  )
}

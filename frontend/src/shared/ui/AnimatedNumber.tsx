import { useEffect, useRef, useState } from 'react'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { formatNumber } from '@/shared/lib/format'

interface Props {
  value: number
  /** Длительность анимации счётчика, мс. */
  duration?: number
  fractionDigits?: number
  className?: string
}

/** Анимированный счётчик для крупных KPI-чисел (раздел 6).
 *  При reduced-motion показывает финальное значение сразу. */
export function AnimatedNumber({ value, duration = 900, fractionDigits = 0, className }: Props) {
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(reduced ? value : 0)
  const fromRef = useRef(0)
  const rafRef = useRef<number>()

  useEffect(() => {
    if (reduced) {
      setDisplay(value)
      return
    }
    const from = fromRef.current
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setDisplay(from + (value - from) * eased)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = value
    }
  }, [value, duration, reduced])

  return <span className={className}>{formatNumber(display, fractionDigits)}</span>
}

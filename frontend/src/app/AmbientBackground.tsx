/* Ambient-фон: статичные радиальные свечения по углам (как на исходных
   слайдах). CSS-only, без WebGL — раздел 6 «уместно». */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute -left-40 -top-40 h-[480px] w-[480px] rounded-full blur-[120px]"
        style={{ background: 'var(--glow-green)' }}
      />
      <div
        className="absolute -right-40 -top-32 h-[420px] w-[420px] rounded-full blur-[120px]"
        style={{ background: 'var(--glow-blue)' }}
      />
      <div className="absolute inset-0 bg-bg-base/40" />
    </div>
  )
}

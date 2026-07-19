/* Тема для recharts. Это часть дизайн-системы (не фича) — здесь
   допустимы конкретные значения цветов, синхронные с tokens.css,
   т.к. SVG-графики требуют конкретных цветов, а не CSS-переменных. */
export const chartTheme = {
  green: '#21A038',
  lime: '#C8E04B',
  blue: '#4FC3F7',
  amber: '#F2C94C',
  red: '#FF6B6B',
  grid: 'rgba(255,255,255,0.06)',
  axis: {
    stroke: 'rgba(255,255,255,0.12)',
    tick: { fill: '#94A39A', fontSize: 11 },
    tickLine: false,
    axisLine: false,
  },
  tooltip: {
    contentStyle: {
      background: '#0E1813',
      border: '1px solid rgba(255,255,255,0.16)',
      borderRadius: 12,
      fontSize: 12,
      color: '#F3F6F4',
    },
    labelStyle: { color: '#94A39A' },
    cursor: { stroke: 'rgba(255,255,255,0.2)' },
  },
  /** Палитра для линий сравнения сценариев. */
  series: ['#C8E04B', '#21A038', '#4FC3F7', '#F2C94C'],
} as const

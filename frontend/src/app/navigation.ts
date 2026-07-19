import {
  LayoutDashboard,
  UploadCloud,
  Workflow,
  SlidersHorizontal,
  Sparkles,
  FileSpreadsheet,
  type LucideIcon,
} from 'lucide-react'

export interface NavEntry {
  to: string
  label: string
  icon: LucideIcon
  /** Краткое пояснение для подписи в навигации. */
  hint: string
  /** Пункт доступен только администратору (напр. загрузка данных). */
  adminOnly?: boolean
}

/** Карта экранов MVP (раздел 3). */
export const NAV: NavEntry[] = [
    { to: '/', label: 'Текущие данные', icon: LayoutDashboard, hint: 'KPI и динамика' },
    { to: '/upload', label: 'Загрузка данных', icon: UploadCloud, hint: 'Excel/CSV, сущности', adminOnly: true },
    { to: '/graph', label: 'Граф бизнес-модели', icon: Workflow, hint: 'Зависимости показателей' },
    { to: '/scenarios', label: 'Сценарии', icon: SlidersHorizontal, hint: 'Планы и сравнение' },
    { to: '/ai', label: 'AI-аналитика', icon: Sparkles, hint: 'Новости и аномалии' },
    { to: '/export', label: 'Экспорт', icon: FileSpreadsheet, hint: 'Выгрузка в Excel' },
]

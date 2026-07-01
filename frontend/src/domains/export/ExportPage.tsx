import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Download, FileSpreadsheet, CheckCircle2, Layers, Table2 } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Select,
  Skeleton,
  Tag,
  Toggle,
} from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { BUSINESS_GRAPH } from '@/mocks/graph'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { exportToCsv, exportToExcel, type ExportSummary } from './lib/exportExcel'

const ALL = '__all__'

type Format = 'xlsx' | 'csv'

export function ExportPage() {
  const prefersReduced = usePrefersReducedMotion()
  const { facts, indicators, loading, loadFacts } = useDatasetStore()

  const [format, setFormat] = useState<Format>('xlsx')
  const [indicatorFilter, setIndicatorFilter] = useState<string>(ALL)
  const [includeFormula, setIncludeFormula] = useState(true)
  const [result, setResult] = useState<ExportSummary | null>(null)

  useEffect(() => {
    loadFacts()
  }, [loadFacts])

  // Сбрасываем сообщение об успехе при изменении параметров выгрузки.
  useEffect(() => {
    setResult(null)
  }, [format, indicatorFilter, includeFormula])

  const isFiltered = indicatorFilter !== ALL
  // CSV — только таблица значений (формула графа в CSV не представима).
  const formulaInExport = format === 'xlsx' && includeFormula

  const previewRows = useMemo(() => {
    if (!isFiltered) return facts.length
    return facts.filter((f) => f.indicator === indicatorFilter).length
  }, [facts, indicatorFilter, isFiltered])

  const previewSheets = useMemo(() => {
    const list = ['Данные']
    if (formulaInExport) list.push('Формула')
    return list
  }, [formulaInExport])

  function handleExport() {
    const summary =
      format === 'csv'
        ? exportToCsv({
            facts,
            indicatorFilter: isFiltered ? indicatorFilter : undefined,
          })
        : exportToExcel({
            facts,
            graph: BUSINESS_GRAPH,
            indicatorFilter: isFiltered ? indicatorFilter : undefined,
            includeFormulaSheet: includeFormula,
          })
    setResult(summary)
  }

  const fade = prefersReduced
    ? {}
    : {
        initial: { opacity: 0, y: 6 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -6 },
        transition: { duration: 0.2 },
      }

  return (
    <div>
      <PageHeader
        title="Экспорт"
        subtitle="Выгрузка таблицы значений в Excel. Отдельным листом — граф и формулы расчёта показателей в читаемом виде."
      />

      {loading ? (
        <Card>
          <CardBody className="space-y-3 pt-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
          </CardBody>
        </Card>
      ) : facts.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<FileSpreadsheet className="h-10 w-10" />}
              title="Нет данных для выгрузки"
              description="Загрузите файл с фактами в разделе «Загрузка данных» — после этого таблицу можно будет выгрузить в Excel."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          {/* Контролы выгрузки */}
          <Card>
            <CardHeader>
              <CardTitle>Параметры выгрузки</CardTitle>
            </CardHeader>
            <CardBody className="space-y-5">
              <Field label="Формат файла">
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'xlsx', label: 'Excel (.xlsx)' },
                    { value: 'csv', label: 'CSV (.csv)' },
                  ] as { value: Format; label: string }[]).map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setFormat(f.value)}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                        format === f.value
                          ? 'border-accent-green/50 bg-accent-green/10 text-text-primary'
                          : 'border-border text-text-secondary hover:bg-surface-hover',
                      )}
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      {f.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field
                label="Показатель"
                htmlFor="export-indicator"
                hint="Таблица значений будет отфильтрована по выбранному показателю."
              >
                <Select
                  id="export-indicator"
                  value={indicatorFilter}
                  onChange={(e) => setIndicatorFilter(e.target.value)}
                >
                  <option value={ALL}>Все показатели</option>
                  {indicators.map((ind) => (
                    <option key={ind} value={ind}>
                      {ind}
                    </option>
                  ))}
                </Select>
              </Field>

              <div
                className={cn(
                  'flex items-start justify-between gap-4 rounded-card border border-border bg-bg-elevated px-4 py-3',
                  format === 'csv' && 'opacity-50',
                )}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    Включить лист с формулой графа
                  </p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {format === 'csv'
                      ? 'Недоступно для CSV — только для Excel.'
                      : 'Формулы расчёта, таблицы узлов и связей бизнес-модели.'}
                  </p>
                </div>
                <div className="pt-0.5">
                  <Toggle
                    checked={formulaInExport}
                    onChange={setIncludeFormula}
                    disabled={format === 'csv'}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  {format === 'csv' ? 'Выгрузить в CSV' : 'Выгрузить в Excel'}
                </Button>

                <AnimatePresence mode="wait">
                  {result && (
                    <motion.span
                      key="export-success"
                      {...fade}
                      className="flex items-center gap-1.5 text-sm text-accent-green"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Файл сформирован: {formatNumber(result.rows, 0)}{' '}
                      {pluralRows(result.rows)}, {result.sheets.length}{' '}
                      {pluralSheets(result.sheets.length)}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </CardBody>
          </Card>

          {/* Превью выгрузки */}
          <Card>
            <CardHeader>
              <CardTitle>Что будет выгружено</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <PreviewStat
                  icon={<Table2 className="h-4 w-4" />}
                  label="Строк"
                  value={formatNumber(previewRows, 0)}
                />
                <PreviewStat
                  icon={<Layers className="h-4 w-4" />}
                  label="Листов"
                  value={String(previewSheets.length)}
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
                  Листы
                </p>
                <ul className="space-y-1.5">
                  {previewSheets.map((name) => (
                    <li
                      key={name}
                      className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-text-muted" />
                      {name}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-text-muted">
                {isFiltered ? (
                  <>
                    Фильтр: <Tag tone="lime">{indicatorFilter}</Tag>
                  </>
                ) : (
                  'Без фильтра — выгружаются все показатели.'
                )}
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}

function PreviewStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-card border border-border bg-bg-elevated px-4 py-3">
      <div className="flex items-center gap-1.5 text-text-muted">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('mt-1 text-2xl font-bold text-text-primary tabular')}>{value}</p>
    </div>
  )
}

function pluralRows(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'строка'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'строки'
  return 'строк'
}

function pluralSheets(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'лист'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'листа'
  return 'листов'
}

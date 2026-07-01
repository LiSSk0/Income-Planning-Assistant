import * as XLSX from 'xlsx'
import type {
  BusinessGraph,
  FactRow,
  GraphNodeModel,
  GraphOperator,
} from '@/shared/lib/api-types'

/** Читаемое представление операторов в формулах. */
const OPERATOR_LABEL: Record<GraphOperator, string> = {
  '*': '×',
  '/': '÷',
  '-': '−',
  '+': '+',
  '%': '%',
}

function operatorLabel(op: GraphOperator): string {
  return OPERATOR_LABEL[op] ?? op
}

export interface ExportOptions {
  facts: FactRow[]
  graph: BusinessGraph
  /** Если задан — лист «Данные» фильтруется по показателю. */
  indicatorFilter?: string
  includeFormulaSheet: boolean
}

export interface ExportSummary {
  rows: number
  sheets: string[]
}

/** Строит строку-формулу для производного узла из входящих рёбер.
 *  Пример: «Доход банка = Объём транзакций × Тариф». */
function buildFormula(node: GraphNodeModel, graph: BusinessGraph): string {
  const incoming = graph.edges.filter((e) => e.target === node.id)
  if (!incoming.length) return ''

  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  const parts: string[] = []
  incoming.forEach((edge, idx) => {
    const sourceNode = byId.get(edge.source)
    const sourceName = sourceNode?.indicator ?? edge.source
    if (idx > 0) parts.push(operatorLabel(edge.operator))
    parts.push(sourceName)
  })

  return `${node.indicator} = ${parts.join(' ')}`
}

/** Выгрузка фактов и (опционально) графа расчёта в книгу Excel. */
export function exportToExcel(opts: ExportOptions): ExportSummary {
  const { facts, graph, indicatorFilter, includeFormulaSheet } = opts

  const wb = XLSX.utils.book_new()
  const sheets: string[] = []

  // ---------- Лист «Данные» ----------
  const filtered = indicatorFilter
    ? facts.filter((f) => f.indicator === indicatorFilter)
    : facts

  const dataRows = filtered.map((f) => ({
    'Отчётный период': f.period,
    'Федеральный округ РФ': f.district,
    'Субъект РФ': f.subject,
    Показатель: f.indicator,
    'Мера измерения': f.unit,
    Значение: f.value,
  }))

  const dataSheet = XLSX.utils.json_to_sheet(dataRows, {
    header: [
      'Отчётный период',
      'Федеральный округ РФ',
      'Субъект РФ',
      'Показатель',
      'Мера измерения',
      'Значение',
    ],
  })
  dataSheet['!cols'] = [{ wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 14 }]
  XLSX.utils.book_append_sheet(wb, dataSheet, 'Данные')
  sheets.push('Данные')

  // ---------- Лист «Формула» ----------
  if (includeFormulaSheet) {
    const aoa: (string | number)[][] = []

    // Раздел 1: формулы расчёта производных показателей.
    aoa.push(['Формулы расчёта'])
    const derived = graph.nodes.filter((n) => n.isDerived)
    if (derived.length) {
      derived.forEach((node) => {
        const formula = buildFormula(node, graph)
        if (formula) aoa.push([formula])
      })
    } else {
      aoa.push(['Производные показатели не заданы'])
    }
    aoa.push([])

    // Раздел 2: таблица узлов.
    aoa.push(['Узлы графа'])
    aoa.push(['Показатель', 'Значение', 'Ед.', 'Тип'])
    graph.nodes.forEach((n) => {
      aoa.push([n.indicator, n.currentValue, n.unit, n.isDerived ? 'производный' : 'источник'])
    })
    aoa.push([])

    // Раздел 3: таблица рёбер.
    const byId = new Map(graph.nodes.map((n) => [n.id, n]))
    aoa.push(['Связи графа'])
    aoa.push(['Из', 'Оператор', 'В'])
    graph.edges.forEach((e) => {
      const from = byId.get(e.source)?.indicator ?? e.source
      const to = byId.get(e.target)?.indicator ?? e.target
      aoa.push([from, operatorLabel(e.operator), to])
    })

    const formulaSheet = XLSX.utils.aoa_to_sheet(aoa)
    formulaSheet['!cols'] = [{ wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, formulaSheet, 'Формула')
    sheets.push('Формула')
  }

  const suffix = indicatorFilter ? sanitizeName(indicatorFilter) : 'all'
  XLSX.writeFile(wb, `Планирование_доходов_${suffix}.xlsx`)

  return { rows: dataRows.length, sheets }
}

/* ---------- CSV-выгрузка ---------- */

/** Экранирование значения для CSV (разделитель «;»). */
function csvCell(value: string | number): string {
  const s = String(value ?? '')
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Выгрузка фактов в CSV (только таблица значений — формула графа в CSV не
 * представима из-за многосекционной структуры; для неё используйте Excel).
 * Разделитель «;» и BOM — чтобы кириллица корректно открывалась в Excel.
 */
export function exportToCsv(opts: Omit<ExportOptions, 'includeFormulaSheet' | 'graph'>): ExportSummary {
  const { facts, indicatorFilter } = opts
  const filtered = indicatorFilter
    ? facts.filter((f) => f.indicator === indicatorFilter)
    : facts

  const headers = [
    'Отчётный период',
    'Федеральный округ РФ',
    'Субъект РФ',
    'Показатель',
    'Мера измерения',
    'Значение',
  ]

  const lines = [headers.join(';')]
  for (const f of filtered) {
    lines.push(
      [f.period, f.district, f.subject, f.indicator, f.unit, f.value].map(csvCell).join(';'),
    )
  }

  // ﻿ — BOM для корректной кириллицы при открытии в Excel.
  const csv = '﻿' + lines.join('\r\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const suffix = indicatorFilter ? sanitizeName(indicatorFilter) : 'all'
  downloadBlob(blob, `Планирование_доходов_${suffix}.csv`)

  return { rows: filtered.length, sheets: ['Данные'] }
}

/** Триггерит скачивание Blob через временную ссылку. */
function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Безопасное имя для файла: убираем символы, недопустимые в имени файла. */
function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '_')
}

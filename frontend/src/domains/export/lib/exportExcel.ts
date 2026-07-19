import * as XLSX from 'xlsx'
import type {
    BusinessGraph,
    FactRow,
    GraphNodeModel,
    GraphOperator,
    Scenario,
} from '@/shared/lib/api-types'

/** Заголовки таблицы данных/прогнозов. */
const DATA_HEADERS = [
    'Отчётный период',
    'Федеральный округ РФ',
    'Субъект РФ',
    'Показатель',
    'Мера измерения',
    'Значение',
] as const

/** Ширины колонок для листов «Данные» и «Прогнозы». */
const DATA_COLS = [{ wch: 16 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 14 }]

/** Преобразует строку факта/прогноза в объект с колонками-заголовками. */
function factToRow(f: FactRow) {
    return {
        'Отчётный период': f.period,
        'Федеральный округ РФ': f.district,
        'Субъект РФ': f.subject,
        Показатель: f.indicator,
        'Мера измерения': f.unit,
        Значение: f.value,
    }
}

/** Строка прогноза: как факт, но с отдельной колонкой «План». */
export interface ForecastRow extends FactRow {
    plan: string
}

/** Заголовки листа «Прогнозы» — с отдельным столбцом «План». */
const FORECAST_HEADERS = [
    'Отчётный период',
    'План',
    'Федеральный округ РФ',
    'Субъект РФ',
    'Показатель',
    'Мера измерения',
    'Значение',
] as const

/** Ширины колонок для листа «Прогнозы». */
const FORECAST_COLS = [{ wch: 16 }, { wch: 24 }, { wch: 22 }, { wch: 18 }, { wch: 28 }, { wch: 16 }, { wch: 14 }]

/** Преобразует строку прогноза в объект с колонками-заголовками. */
function forecastToRow(f: ForecastRow) {
    return {
        'Отчётный период': f.period,
        План: f.plan,
        'Федеральный округ РФ': f.district,
        'Субъект РФ': f.subject,
        Показатель: f.indicator,
        'Мера измерения': f.unit,
        Значение: f.value,
    }
}

/**
 * Разворачивает сценарий-прогноз в плоские строки таблицы.
 * Приоритет — актуальные данные из `regionForecasts` (лучшая модель на регион),
 * с фолбэком на legacy-поле `series`.
 * Имя плана попадает в отдельное поле `plan`. «Федеральный округ РФ» (`district`)
 * подставляется по субъекту из `subjectToDistrict` (справочник из фактов),
 * если соответствие найдено.
 */
export function scenarioToForecastRows(
    scenario: Scenario,
    subjectToDistrict?: Map<string, string>,
): ForecastRow[] {
    const indicator = scenario.params?.targetIndicator || scenario.targetIndicator || ''
    const plan = scenario.title || 'План'
    const districtFor = (subject: string) => subjectToDistrict?.get(subject) ?? ''

    const regions = scenario.regionForecasts ? Object.keys(scenario.regionForecasts) : []
    if (regions.length > 0) {
        const rows: ForecastRow[] = []
        for (const region of regions) {
            const models = scenario.regionForecasts[region] || []
            const model = models[0] // модели отсортированы по rank
            if (!model || !model.forecast) continue
            for (const [period, value] of Object.entries(model.forecast)) {
                rows.push({
                    period,
                    plan,
                    district: districtFor(region),
                    subject: region,
                    indicator,
                    unit: 'руб',
                    value,
                })
            }
        }
        if (rows.length > 0) return rows
    }

    // Фолбэк на legacy-серию
    return (scenario.series || []).map((p) => ({
        period: p.period,
        plan,
        district: '',
        subject: 'Прогноз',
        indicator,
        unit: 'руб',
        value: p.value,
    }))
}

/** Строит справочник «субъект → федеральный округ» из строк фактов. */
export function buildSubjectToDistrict(facts: FactRow[]): Map<string, string> {
    const map = new Map<string, string>()
    for (const f of facts) {
        if (f.subject && f.district && !map.has(f.subject)) {
            map.set(f.subject, f.district)
        }
    }
    return map
}

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
    indicatorFilter?: string
    includeFormulaSheet: boolean
    /** Строки карточек-прогнозов для отдельного листа «Прогнозы». */
    predictionRows?: ForecastRow[]
}

export interface ExportSummary {
    rows: number
    sheets: string[]
}

/** Очищает id узла от префиксов и суффиксов */
function cleanNodeId(id: string): string {
    // Убираем ind- в начале
    let cleaned = id.replace(/^ind-/, '')
    // Убираем суффикс -число в конце
    cleaned = cleaned.replace(/-\d+$/, '')
    return cleaned
}

/** Строит строку-формулу для узла из входящих рёбер */
function buildFormulaForTarget(
    targetId: string,
    graph: BusinessGraph,
    nodeMap: Map<string, GraphNodeModel>
): string | null {
    const incoming = graph.edges.filter((e) => e.target === targetId)
    if (incoming.length === 0) return null

    const targetNode = nodeMap.get(targetId)
    const targetName = targetNode?.indicator || cleanNodeId(targetId)

    const parts: string[] = []
    incoming.forEach((edge, idx) => {
        const sourceNode = nodeMap.get(edge.source)
        const sourceName = sourceNode?.indicator || cleanNodeId(edge.source)
        if (idx > 0) parts.push(operatorLabel(edge.operator))
        parts.push(sourceName)
    })

    return `${targetName} = ${parts.join(' ')}`
}

export function exportToExcel(opts: ExportOptions): ExportSummary {
    const { facts, graph, indicatorFilter, includeFormulaSheet, predictionRows } = opts

    const wb = XLSX.utils.book_new()
    const sheets: string[] = []

    // ---------- Лист «Данные» ----------
    const filtered = indicatorFilter
        ? facts.filter((f) => f.indicator === indicatorFilter)
        : facts

    const dataRows = filtered.map(factToRow)

    const dataSheet = XLSX.utils.json_to_sheet(dataRows, { header: [...DATA_HEADERS] })
    dataSheet['!cols'] = DATA_COLS
    XLSX.utils.book_append_sheet(wb, dataSheet, 'Данные')
    sheets.push('Данные')

    // ---------- Лист «Формула» ----------
    if (includeFormulaSheet) {
        const aoa: (string | number)[][] = []

        const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))

        // ✅ Проверяем, есть ли рёбра в графе
        const hasEdges = graph.edges.length > 0
        const hasNodes = graph.nodes.length > 0

        if (!hasNodes || !hasEdges) {
            aoa.push(['📊 Граф бизнес-модели'])
            aoa.push([])
            aoa.push(['Граф пуст.'])
            aoa.push(['Для отображения формул:'])
            aoa.push(['1. Перейдите на вкладку «Граф бизнес-модели»'])
            aoa.push(['2. Нажмите «Регенерация» для построения графа из показателей'])
            aoa.push(['3. Соедините узлы рёбрами с операторами'])
            aoa.push(['4. Нажмите «Сохранить» для отправки формул на сервер'])
        } else {
            // ---------- РАЗДЕЛ 1: ФОРМУЛЫ ----------
            aoa.push(['📊 ФОРМУЛЫ РАСЧЁТА'])
            aoa.push([])

            // Находим все узлы, у которых есть входящие рёбра (цели)
            const targets = new Set(graph.edges.map((e) => e.target))
            const formulas: string[] = []

            for (const targetId of targets) {
                const formula = buildFormulaForTarget(targetId, graph, nodeMap)
                if (formula) formulas.push(formula)
            }

            if (formulas.length === 0) {
                aoa.push(['Нет формул. Соедините узлы рёбрами.'])
            } else {
                formulas.forEach((f) => aoa.push([f]))
            }
            aoa.push([])

            // ---------- РАЗДЕЛ 2: УЗЛЫ ----------
            aoa.push(['📋 УЗЛЫ ГРАФА'])
            aoa.push([])
            aoa.push(['Показатель', 'Значение', 'Ед. изм.', 'Тип'])

            // Сначала показываем узлы с indicator
            const nodesWithIndicator = graph.nodes.filter((n) => n.indicator && n.indicator.trim() !== '')
            const nodesWithoutIndicator = graph.nodes.filter((n) => !n.indicator || n.indicator.trim() === '')

            nodesWithIndicator.forEach((n) => {
                const value = n.currentValue ?? 0
                aoa.push([
                    n.indicator,
                    typeof value === 'number' ? value : 0,
                    n.unit || '—',
                    n.isDerived ? 'Производный' : 'Источник',
                ])
            })

            // Если есть узлы без индикатора, показываем их очищенные id
            if (nodesWithoutIndicator.length > 0) {
                nodesWithoutIndicator.forEach((n) => {
                    const name = cleanNodeId(n.id)
                    aoa.push([
                        name,
                        n.currentValue ?? 0,
                        n.unit || '—',
                        n.isDerived ? 'Производный' : 'Источник',
                    ])
                })
            }
            aoa.push([])

            // ---------- РАЗДЕЛ 3: СВЯЗИ ----------
            if (hasEdges) {
                aoa.push(['🔗 СВЯЗИ ГРАФА'])
                aoa.push([])
                aoa.push(['Из', 'Оператор', 'В'])

                graph.edges.forEach((e) => {
                    const sourceNode = nodeMap.get(e.source)
                    const targetNode = nodeMap.get(e.target)

                    const from = sourceNode?.indicator || cleanNodeId(e.source)
                    const to = targetNode?.indicator || cleanNodeId(e.target)

                    aoa.push([from, operatorLabel(e.operator), to])
                })
            }
        }

        const formulaSheet = XLSX.utils.aoa_to_sheet(aoa)
        formulaSheet['!cols'] = [{ wch: 40 }, { wch: 16 }, { wch: 40 }]
        XLSX.utils.book_append_sheet(wb, formulaSheet, 'Формула')
        sheets.push('Формула')
    }

    // ---------- Лист «Прогнозы» ----------
    if (predictionRows && predictionRows.length > 0) {
        const predSheet = XLSX.utils.json_to_sheet(predictionRows.map(forecastToRow), {
            header: [...FORECAST_HEADERS],
        })
        predSheet['!cols'] = FORECAST_COLS
        XLSX.utils.book_append_sheet(wb, predSheet, 'Прогнозы')
        sheets.push('Прогнозы')
    }

    const suffix = indicatorFilter ? sanitizeName(indicatorFilter) : 'all'
    const wbout = XLSX.write(wb, {
        bookType: 'xlsx',
        type: 'array',
        bookSST: false,
    })

    const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=utf-8',
    })
    downloadBlob(blob, `Планирование_доходов_${suffix}.xlsx`)

    return { rows: dataRows.length + (predictionRows?.length ?? 0), sheets }
}

/* ---------- CSV-выгрузка ---------- */

function csvCell(value: string | number): string {
    const s = String(value ?? '')
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function exportToCsv(opts: Omit<ExportOptions, 'includeFormulaSheet' | 'graph'>): ExportSummary {
    const { facts, indicatorFilter, predictionRows } = opts
    const filtered = indicatorFilter
        ? facts.filter((f) => f.indicator === indicatorFilter)
        : facts

    const hasForecasts = !!predictionRows && predictionRows.length > 0

    // Когда есть прогнозы, добавляем отдельную колонку «План» (у фактов она пустая).
    const factLine = (f: FactRow) =>
        (hasForecasts
            ? [f.period, '', f.district, f.subject, f.indicator, f.unit, f.value]
            : [f.period, f.district, f.subject, f.indicator, f.unit, f.value]
        ).map(csvCell).join(';')

    const forecastLine = (f: ForecastRow) =>
        [f.period, f.plan, f.district, f.subject, f.indicator, f.unit, f.value].map(csvCell).join(';')

    const headers = hasForecasts ? FORECAST_HEADERS : DATA_HEADERS
    const lines = [[...headers].join(';')]
    for (const f of filtered) lines.push(factLine(f))
    // Строки карточек-прогнозов дописываем в конец той же таблицы
    for (const f of predictionRows ?? []) lines.push(forecastLine(f))

    const csv = '\uFEFF' + lines.join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const suffix = indicatorFilter ? sanitizeName(indicatorFilter) : 'all'
    downloadBlob(blob, `Планирование_доходов_${suffix}.csv`)

    return { rows: filtered.length + (predictionRows?.length ?? 0), sheets: ['Данные'] }
}

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

function sanitizeName(name: string): string {
    return name.replace(/[\\/:*?"<>|]+/g, '').trim().replace(/\s+/g, '_')
}
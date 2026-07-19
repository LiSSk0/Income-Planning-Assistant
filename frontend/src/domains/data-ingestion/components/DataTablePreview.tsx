import { useMemo, useRef, useState, useEffect } from 'react'
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
    type ColumnDef,
    type SortingState,
} from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search } from 'lucide-react'
import { Input } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'
import type { FactRow } from '@/shared/lib/api-types'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { formatNumber, formatPeriod } from '@/shared/lib/format'

const ROW_HEIGHT = 36
const CONTAINER_HEIGHT = 480

type SortKey = keyof FactRow
type SortDir = 'asc' | 'desc'

interface ColumnConfig {
    key: SortKey
    header: string
    align?: 'right'
    width: string
    render: (row: FactRow) => string
    className?: string
}

const COLUMNS: ColumnConfig[] = [
    { key: 'period', header: 'Период', width: '120px', render: (r) => formatPeriod(r.period) },
    { key: 'district', header: 'Федеральный округ', width: '200px', render: (r) => r.district },
    { key: 'subject', header: 'Субъект РФ', width: '220px', render: (r) => r.subject },
    { key: 'indicator', header: 'Показатель', width: '260px', render: (r) => r.indicator },
    { key: 'unit', header: 'Мера', width: '90px', render: (r) => r.unit },
    {
        key: 'value',
        header: 'Значение',
        width: '140px',
        align: 'right',
        className: 'tabular',
        render: (r) => formatNumber(r.value),
    },
]

export function DataTablePreview() {
    const { facts, loading, loadFacts } = useDatasetStore()

    const [query, setQuery] = useState('')
    const [sortKey, setSortKey] = useState<SortKey | null>(null)
    const [sortDir, setSortDir] = useState<SortDir>('asc')

    // ✅ Загружаем данные при монтировании
    useEffect(() => {
        loadFacts()
    }, [])

    // ✅ Фильтрация по subject/indicator
    const filtered = useMemo<FactRow[]>(() => {
        const q = query.trim().toLowerCase()
        if (!q) return facts
        return facts.filter(
            (r) =>
                r.subject.toLowerCase().includes(q) || r.indicator.toLowerCase().includes(q),
        )
    }, [facts, query])

    // ✅ Сортировка
    const rows = useMemo<FactRow[]>(() => {
        if (!sortKey) return filtered
        const dir = sortDir === 'asc' ? 1 : -1
        const copy = filtered.slice()
        copy.sort((a, b) => {
            const av = a[sortKey]
            const bv = b[sortKey]
            if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir
            return String(av).localeCompare(String(bv), 'ru') * dir
        })
        return copy
    }, [filtered, sortKey, sortDir])

    // ✅ Колонки для react-table
    const columns = useMemo<ColumnDef<FactRow>[]>(
        () =>
            COLUMNS.map((c) => ({
                id: c.key,
                accessorKey: c.key,
                header: c.header,
            })),
        [],
    )

    const sorting: SortingState = sortKey ? [{ id: sortKey, desc: sortDir === 'desc' }] : []
    const table = useReactTable({
        data: rows,
        columns,
        state: { sorting },
        getCoreRowModel: getCoreRowModel(),
        manualSorting: true,
        manualFiltering: true,
    })

    const tableRows = table.getRowModel().rows

    const scrollRef = useRef<HTMLDivElement>(null)
    const virtualizer = useVirtualizer({
        count: tableRows.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => ROW_HEIGHT,
        overscan: 12,
    })

    const virtualItems = virtualizer.getVirtualItems()
    const totalSize = virtualizer.getTotalSize()
    const paddingTop = virtualItems.length ? virtualItems[0].start : 0
    const paddingBottom = virtualItems.length
        ? totalSize - virtualItems[virtualItems.length - 1].end
        : 0

    function toggleSort(key: SortKey) {
        if (sortKey !== key) {
            setSortKey(key)
            setSortDir('asc')
        } else if (sortDir === 'asc') {
            setSortDir('desc')
        } else {
            setSortKey(null)
            setSortDir('asc')
        }
    }

    // ✅ Показываем загрузку
    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent-green border-t-transparent" />
                <span className="ml-3 text-text-secondary">Загрузка данных...</span>
            </div>
        )
    }

    // ✅ Показываем сообщение, если данных нет
    if (facts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-text-secondary">Нет загруженных данных</p>
                <p className="text-sm text-text-muted">Загрузите файл Excel или CSV, чтобы увидеть предпросмотр</p>
            </div>
        )
    }

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div className="relative w-full max-w-sm">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Фильтр по субъекту или показателю…"
                        className="pl-9"
                        aria-label="Текстовый фильтр строк"
                    />
                </div>
                <span className="tabular text-sm text-text-secondary">
                    {formatNumber(rows.length)} строк
                    {rows.length !== facts.length && (
                        <span className="text-text-muted"> из {formatNumber(facts.length)}</span>
                    )}
                </span>
            </div>

            <div className="overflow-hidden rounded-card border border-border">
                <div
                    ref={scrollRef}
                    className="overflow-auto"
                    style={{ height: CONTAINER_HEIGHT }}
                >
                    <table
                        className="w-full border-collapse text-sm"
                        style={{ tableLayout: 'fixed' }}
                    >
                        <colgroup>
                            {COLUMNS.map((c) => (
                                <col key={c.key} style={{ width: c.width }} />
                            ))}
                        </colgroup>
                        <thead className="sticky top-0 z-10 bg-bg-elevated">
                            <tr>
                                {COLUMNS.map((c) => {
                                    const active = sortKey === c.key
                                    return (
                                        <th
                                            key={c.key}
                                            onClick={() => toggleSort(c.key)}
                                            className={cn(
                                                'select-none border-b border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide',
                                                'cursor-pointer text-text-secondary hover:text-text-primary',
                                                c.align === 'right' ? 'text-right' : 'text-left',
                                                active && 'text-accent-lime',
                                            )}
                                            aria-sort={
                                                active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'
                                            }
                                        >
                                            <span
                                                className={cn(
                                                    'inline-flex items-center gap-1',
                                                    c.align === 'right' && 'flex-row-reverse',
                                                )}
                                            >
                                                {c.header}
                                                {active ? (
                                                    sortDir === 'asc' ? (
                                                        <ArrowUp className="h-3 w-3" />
                                                    ) : (
                                                        <ArrowDown className="h-3 w-3" />
                                                    )
                                                ) : (
                                                    <ChevronsUpDown className="h-3 w-3 opacity-40" />
                                                )}
                                            </span>
                                        </th>
                                    )
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {paddingTop > 0 && (
                                <tr aria-hidden>
                                    <td colSpan={COLUMNS.length} style={{ height: paddingTop }} />
                                </tr>
                            )}
                            {virtualItems.map((vi) => {
                                const row = tableRows[vi.index].original
                                return (
                                    <tr
                                        key={vi.key}
                                        style={{ height: ROW_HEIGHT }}
                                        className="border-b border-border/60 hover:bg-surface-hover"
                                    >
                                        {COLUMNS.map((c) => (
                                            <td
                                                key={c.key}
                                                className={cn(
                                                    'truncate px-3 text-text-primary',
                                                    c.align === 'right' ? 'text-right' : 'text-left',
                                                    c.className,
                                                )}
                                            >
                                                {c.render(row)}
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                            {paddingBottom > 0 && (
                                <tr aria-hidden>
                                    <td colSpan={COLUMNS.length} style={{ height: paddingBottom }} />
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <p className="mt-2 text-xs text-text-muted">
                Рендерятся только видимые строки (виртуализация). Сортировка и фильтрация
                выполняются на уровне данных, а не DOM.
                {facts.length > 10000 && ` · ${formatNumber(facts.length)} строк в памяти`}
            </p>
        </div>
    )
}
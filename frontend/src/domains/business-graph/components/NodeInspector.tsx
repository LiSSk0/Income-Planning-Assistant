/* Боковая панель инспектора: при клике на узел показывает формулу его
   сборки (для производных — входящие рёбра «A <оператор> B = Узел»)
   и список драйверов с операторами. */
import { X } from 'lucide-react'
import type { Edge, Node } from '@xyflow/react'
import type { GraphOperator } from '@/shared/lib/api-types'
import { Card, CardBody, CardTitle } from '@/shared/ui'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { OPERATOR_COLOR, OPERATOR_SYMBOL, type IndicatorNodeData } from '../lib/mapToFlow'

interface Props {
  node: Node<IndicatorNodeData>
  nodes: Node<IndicatorNodeData>[]
  edges: Edge[]
  onClose: () => void
  /** Переключить тип узла: базовый ↔ производный. */
  onToggleDerived: (id: string) => void
}

const TONE_BY_OP: Record<GraphOperator, 'green' | 'red' | 'blue' | 'amber' | 'lime'> = {
  '+': 'green',
  '-': 'red',
  '*': 'blue',
  '/': 'amber',
  '%': 'lime',
}

export function NodeInspector({ node, nodes, edges, onClose, onToggleDerived }: Props) {
  const isDerived = node.data.isDerived
  const byId = new Map(nodes.map((n) => [n.id, n]))

  // Входящие рёбра = драйверы этого узла.
  const incoming = edges.filter((e) => e.target === node.id)

  // Формула: «Узел = A <op> B <op> C» (порядок — как в списке рёбер).
  const drivers = incoming.map((e) => {
    const op = (e.data?.operator as GraphOperator) ?? '+'
    const src = byId.get(e.source)
    return {
      id: e.id,
      op,
      sourceName: src?.data.indicator ?? e.source,
      sourceValue: src?.data.currentValue ?? 0,
      sourceUnit: src?.data.unit ?? '',
    }
  })

  return (
    <Card className="flex w-full flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <CardTitle className="text-accent-lime">{node.data.indicator}</CardTitle>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="tabular text-xl font-bold text-text-primary">
              {formatNumber(node.data.currentValue)}
            </span>
            <span className="text-xs text-text-muted">{node.data.unit}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Закрыть инспектор"
          className="rounded-lg p-1 text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <CardBody className="space-y-4 pt-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Тип показателя
          </span>
          {/* Пользователь сам выбирает: базовый (источник) или производный. */}
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => isDerived && onToggleDerived(node.id)}
              aria-pressed={!isDerived}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm transition-colors',
                !isDerived
                  ? 'border-accent-green/50 bg-accent-green/10 text-text-primary'
                  : 'border-border text-text-secondary hover:bg-surface-hover',
              )}
            >
              Базовая
            </button>
            <button
              type="button"
              onClick={() => !isDerived && onToggleDerived(node.id)}
              aria-pressed={isDerived}
              className={cn(
                'rounded-lg border px-3 py-2 text-sm transition-colors',
                isDerived
                  ? 'border-accent-lime/50 bg-accent-lime/10 text-text-primary'
                  : 'border-border text-text-secondary hover:bg-surface-hover',
              )}
            >
              Производная
            </button>
          </div>
        </div>

        {node.data.isDerived && drivers.length > 0 ? (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Формула сборки
            </span>
            <div className="mt-2 rounded-lg border border-border bg-bg-elevated px-3 py-2.5 text-sm leading-relaxed text-text-primary">
              <span className="font-semibold text-accent-lime">{node.data.indicator}</span>
              {' = '}
              {drivers.map((d, i) => (
                <span key={d.id}>
                  {i > 0 && (
                    <span
                      className="mx-1 font-bold"
                      style={{ color: OPERATOR_COLOR[d.op] }}
                    >
                      {OPERATOR_SYMBOL[d.op]}
                    </span>
                  )}
                  <span className="text-text-primary">{d.sourceName}</span>
                </span>
              ))}
            </div>
          </div>
        ) : node.data.isDerived ? (
          <p className="text-sm text-text-muted">
            Нет входящих драйверов. Соедините показатели рёбрами, чтобы задать формулу.
          </p>
        ) : (
          <p className="text-sm text-text-muted">
            Исходный показатель — берётся из загруженных данных и питает производные узлы.
          </p>
        )}

        {drivers.length > 0 && (
          <div>
            <span className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Драйверы ({drivers.length})
            </span>
            <ul className="mt-2 space-y-1.5">
              {drivers.map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-md text-sm font-bold',
                      )}
                      style={{
                        color: OPERATOR_COLOR[d.op],
                        background: 'var(--bg-elevated)',
                      }}
                      aria-hidden
                    >
                      {OPERATOR_SYMBOL[d.op]}
                    </span>
                    <span className="text-sm text-text-primary">{d.sourceName}</span>
                  </span>
                  <span className="tabular shrink-0 text-xs text-text-secondary">
                    {formatNumber(d.sourceValue)} {d.sourceUnit}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  )
}

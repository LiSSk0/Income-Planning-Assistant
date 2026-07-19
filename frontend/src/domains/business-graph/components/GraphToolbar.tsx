/* Панель управления графом: авто-лэйаут, очистка связей, регенерация
   (перезапрос из БД + очистка + авто-лэйаут) и выбор оператора для новых
   рёбер. Плюс короткая подсказка о способе соединения узлов. */
import { LayoutGrid, Eraser, RefreshCw, Spline, Save, Check, PlusCircle, Loader2 } from 'lucide-react'
import type { GraphOperator } from '@/shared/lib/api-types'
import { Button, Card, Select, Tag } from '@/shared/ui'
import { OPERATOR_OPTIONS } from '../lib/mapToFlow'

interface Props {
  operator: GraphOperator
  onOperatorChange: (op: GraphOperator) => void
  onAutoLayout: () => void
  onClearEdges: () => void
  onRegenerate: () => void
  onSave: () => void
  /** Добавить промежуточный узел-операцию (для сложных формул). */
  onAddOperation: () => void
  /** Идёт ли перезапрос графа из БД (блокируем кнопку, крутим иконку). */
  regenerating?: boolean
  /** Есть ли что очищать (нет рёбер — кнопка очистки неактивна). */
  hasEdges?: boolean
  /** Показывать ли отметку «Сохранено» (сбрасывается через пару секунд). */
  justSaved?: boolean
  /** Идёт ли отправка формул на бэкенд. */
  saving?: boolean
}

export function GraphToolbar({
  operator,
  onOperatorChange,
  onAutoLayout,
  onClearEdges,
  onRegenerate,
  onSave,
  onAddOperation,
  regenerating = false,
  hasEdges = true,
  justSaved = false,
  saving = false,
}: Props) {
  return (
    <Card className="flex flex-wrap items-end gap-3 px-4 py-3">
      <Button variant="secondary" size="sm" onClick={onAutoLayout}>
        <LayoutGrid className="h-4 w-4" />
        Авто-лэйаут
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={onClearEdges}
        disabled={!hasEdges}
        title="Удалить все связи на канвасе"
      >
        <Eraser className="h-4 w-4" />
        Очистить связи
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={onRegenerate}
        disabled={regenerating}
        title="Перезапросить граф из БД, очистить связи и переразложить"
      >
        <RefreshCw className={'h-4 w-4' + (regenerating ? ' animate-spin' : '')} />
        {regenerating ? 'Регенерация…' : 'Регенерация'}
      </Button>

      <Button
        variant="secondary"
        size="sm"
        onClick={onAddOperation}
        title="Добавить промежуточную операцию (для формул вида a×b+c или (a+b)×c)"
      >
        <PlusCircle className="h-4 w-4" />
        Добавить операцию
      </Button>

      <Button
        size="sm"
        onClick={onSave}
        disabled={saving}
        title="Сохранить граф и отправить все формулы на бэкенд"
      >
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : justSaved ? (
          <Check className="h-4 w-4" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saving ? 'Сохранение…' : justSaved ? 'Сохранено' : 'Сохранить'}
      </Button>

      <label className="block space-y-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">
          Оператор (ребро / новая операция)
        </span>
        <Select
          value={operator}
          onChange={(e) => onOperatorChange(e.target.value as GraphOperator)}
          className="h-8 w-52 text-sm"
          aria-label="Оператор нового ребра или операции"
        >
          {OPERATOR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </label>

      <Tag tone="neutral" className="ml-auto self-center">
        <Spline className="h-3.5 w-3.5" />
        Соедините узлы через операции: тяните от правого порта к левому
      </Tag>
    </Card>
  )
}

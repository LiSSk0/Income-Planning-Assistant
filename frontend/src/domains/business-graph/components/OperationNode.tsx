/* Промежуточный узел-операция — «точка» на графе для сборки сложных формул
   (a * b + c = d, (a + b) * c = d). В узел входят несколько показателей/
   операций, а исходящее ребро передаёт результат операции дальше.
   Компактный круглый узел с символом оператора. */
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/shared/lib/cn'
import { OPERATOR_COLOR, OPERATOR_SYMBOL, type OperationNodeData } from '../lib/mapToFlow'

function OperationNodeImpl({ data, selected }: NodeProps) {
    const node = data as OperationNodeData
    const color = OPERATOR_COLOR[node.operator]

    return (
        <div
            className={cn(
                'flex h-12 w-12 items-center justify-center rounded-full border-2 bg-surface-card shadow-card transition-shadow',
                selected && 'ring-2 ring-accent-lime',
            )}
            style={{ borderColor: color }}
            title={`Операция: ${OPERATOR_SYMBOL[node.operator]}`}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!h-2.5 !w-2.5 !border-border-strong !bg-bg-elevated"
            />
            <span className="text-xl font-bold leading-none" style={{ color }}>
                {OPERATOR_SYMBOL[node.operator]}
            </span>
            <Handle
                type="source"
                position={Position.Right}
                className="!h-2.5 !w-2.5 !border-border-strong !bg-accent-green"
            />
        </div>
    )
}

export const OperationNode = memo(OperationNodeImpl)
OperationNode.displayName = 'OperationNode'
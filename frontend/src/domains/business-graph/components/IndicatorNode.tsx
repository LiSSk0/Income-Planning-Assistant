import { memo, useRef } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/shared/lib/cn'
import { formatNumber } from '@/shared/lib/format'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { NODE_HEIGHT, NODE_WIDTH } from '../lib/layout'
import type { IndicatorNodeData } from '../lib/mapToFlow'

const TILT = 5

function IndicatorNodeImpl({ data, selected }: NodeProps) {
    const node = data as IndicatorNodeData
    const reduced = usePrefersReducedMotion()
    const ref = useRef<HTMLDivElement>(null)

    const px = useMotionValue(0)
    const py = useMotionValue(0)
    const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [TILT, -TILT]), {
        stiffness: 260,
        damping: 20,
    })
    const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-TILT, TILT]), {
        stiffness: 260,
        damping: 20,
    })

    function handleMove(e: React.MouseEvent<HTMLDivElement>) {
        if (reduced) return
        const rect = ref.current?.getBoundingClientRect()
        if (!rect) return
        px.set((e.clientX - rect.left) / rect.width - 0.5)
        py.set((e.clientY - rect.top) / rect.height - 0.5)
    }

    function handleLeave() {
        px.set(0)
        py.set(0)
    }

    const isDerived = node.isDerived

    return (
        <motion.div
            ref={ref}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            style={
                reduced
                    ? undefined
                    : { rotateX, rotateY, transformPerspective: 700, transformStyle: 'preserve-3d' }
            }
            className={cn(
                'flex flex-col justify-between rounded-card border bg-surface-card px-3.5 py-3 shadow-card',
                'transition-colors',
                isDerived ? 'border-accent-lime/60' : 'border-border-strong',
                selected && 'ring-2 ring-accent-lime'
            )}
        >
            <Handle
                type="target"
                position={Position.Left}
                className="!h-2.5 !w-2.5 !border-border-strong !bg-bg-elevated"
            />

            <div style={{ width: NODE_WIDTH - 28, minHeight: NODE_HEIGHT - 24 }} className="flex flex-col justify-between">
                <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-xs font-medium leading-tight text-text-secondary">
                        {node.indicator}
                    </span>
                    {isDerived ? (
                        <span className="shrink-0 rounded-pill border border-accent-lime/30 bg-accent-lime/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent-lime">
                            производная
                        </span>
                    ) : (
                        <span className="shrink-0 rounded-pill border border-border bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-text-muted">
                            базовая
                        </span>
                    )}
                </div>

                <div className="mt-1.5 flex items-baseline gap-1.5">
                    <span
                        className={cn(
                            'tabular text-lg font-bold leading-none',
                            isDerived ? 'text-accent-lime' : 'text-text-primary'
                        )}
                    >
                        {formatNumber(node.currentValue)}
                    </span>
                    <span className="text-[11px] text-text-muted">{node.unit}</span>
                </div>
            </div>

            <Handle
                type="source"
                position={Position.Right}
                className="!h-2.5 !w-2.5 !border-border-strong !bg-accent-green"
            />
        </motion.div>
    )
}

export const IndicatorNode = memo(IndicatorNodeImpl)
IndicatorNode.displayName = 'IndicatorNode'
import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export const Checkbox = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
    ({ className, ...props }, ref) => (
        <input
            ref={ref}
            type="checkbox"
            className={cn(
                'h-4 w-4 rounded border-border bg-bg-elevated accent-accent-green',
                'focus:ring-2 focus:ring-accent-lime focus:ring-offset-2 focus:ring-offset-bg-base',
                className
            )}
            {...props}
        />
    )
)
Checkbox.displayName = 'Checkbox'
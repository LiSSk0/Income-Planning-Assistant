import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/shared/lib/cn'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Ширина модалки (Tailwind-класс). По умолчанию max-w-md */
  maxWidth?: string
}

/**
 * Базовое модальное окно с бэкдропом, анимацией и закрытием по Esc / клику вне.
 * Стилизация соответствует дизайн-системе проекта (тёмная тема, border-subtle,
 * surface-card, accent-green).
 */
export function Modal({ open, onClose, children, maxWidth = 'max-w-md' }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Закрытие по Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  // Блокировка прокрутки фона
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      ref={overlayRef}
      className={cn(
        'fixed inset-0 z-[9999] flex items-center justify-center p-4',
        'bg-black/60 backdrop-blur-sm',
        'animate-[modal-overlay-in_0.2s_ease-out_both]',
      )}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full',
          maxWidth,
          'rounded-card border border-border-strong bg-surface-card shadow-card',
          'animate-[modal-panel-in_0.25s_ease-out_both]',
        )}
      >
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
          aria-label="Закрыть"
        >
          <X className="h-4 w-4" />
        </button>

        {children}
      </div>
    </div>,
    document.body,
  )
}

/* ─── Вспомогательные субкомпоненты для структуры ─── */

export function ModalHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 pt-6 pb-2', className)} {...props} />
}

export function ModalBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-6 py-3', className)} {...props} />
}

export function ModalFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 px-6 pb-6 pt-3',
        className,
      )}
      {...props}
    />
  )
}

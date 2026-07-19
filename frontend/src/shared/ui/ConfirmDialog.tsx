import { type ReactNode } from 'react'
import { Modal, ModalHeader, ModalBody, ModalFooter } from './Modal'
import { Button } from './Button'
import { AlertTriangle, CheckCircle, XCircle, Info } from 'lucide-react'

type DialogVariant = 'danger' | 'success' | 'warning' | 'info'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** Описание / тело диалога */
  children?: ReactNode
  /** Текст кнопки подтверждения */
  confirmLabel?: string
  /** Текст кнопки отмены */
  cancelLabel?: string
  /** Вариант оформления (иконка + цвет кнопки) */
  variant?: DialogVariant
  /** Заблокировать кнопку подтверждения (например, пока идёт запрос) */
  loading?: boolean
}

const icons: Record<DialogVariant, ReactNode> = {
  danger: <AlertTriangle className="h-6 w-6 text-accent-red" />,
  warning: <AlertTriangle className="h-6 w-6 text-accent-amber" />,
  success: <CheckCircle className="h-6 w-6 text-accent-green" />,
  info: <Info className="h-6 w-6 text-accent-blue" />,
}

const iconBg: Record<DialogVariant, string> = {
  danger: 'bg-accent-red/10 border-accent-red/20',
  warning: 'bg-accent-amber/10 border-accent-amber/20',
  success: 'bg-accent-green/10 border-accent-green/20',
  info: 'bg-accent-blue/10 border-accent-blue/20',
}

/**
 * Готовый диалог подтверждения действия.
 * Стилизован под тёмную «дата-центр» тему проекта.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  children,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  variant = 'danger',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconBg[variant]}`}
          >
            {icons[variant]}
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-base font-semibold text-text-primary leading-snug">
              {title}
            </h3>
          </div>
        </div>
      </ModalHeader>

      {children && (
        <ModalBody>
          <div className="text-sm text-text-secondary leading-relaxed pl-[60px]">
            {children}
          </div>
        </ModalBody>
      )}

      <ModalFooter>
        <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          disabled={loading}
          className="min-w-[120px]"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Выполнение…
            </span>
          ) : (
            confirmLabel
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

/* ─── Простой Alert-диалог (только информация, одна кнопка) ─── */

interface AlertDialogProps {
  open: boolean
  onClose: () => void
  title: string
  children?: ReactNode
  variant?: DialogVariant
  buttonLabel?: string
}

export function AlertDialog({
  open,
  onClose,
  title,
  children,
  variant = 'info',
  buttonLabel = 'Понятно',
}: AlertDialogProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <ModalHeader>
        <div className="flex items-start gap-4">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${iconBg[variant]}`}
          >
            {icons[variant]}
          </div>
          <div className="min-w-0 pt-0.5">
            <h3 className="text-base font-semibold text-text-primary leading-snug">
              {title}
            </h3>
          </div>
        </div>
      </ModalHeader>

      {children && (
        <ModalBody>
          <div className="text-sm text-text-secondary leading-relaxed pl-[60px]">
            {children}
          </div>
        </ModalBody>
      )}

      <ModalFooter>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onClose}>
          {buttonLabel}
        </Button>
      </ModalFooter>
    </Modal>
  )
}

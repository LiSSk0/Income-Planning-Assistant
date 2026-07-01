import { Navigate, useLocation } from 'react-router-dom'
import { useSessionStore, type Role } from '@/shared/store/useSessionStore'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
  /** Если задано — пускаем только пользователя с этой ролью. */
  role?: Role
}

/** Гард: неавторизованных отправляем на экран входа; при несовпадении
 *  роли (напр. менеджер пытается открыть загрузку) — на главную. */
export function RequireAuth({ children, role }: Props) {
  const user = useSessionStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />
  if (role && user.role !== role) return <Navigate to="/" replace />
  return <>{children}</>
}

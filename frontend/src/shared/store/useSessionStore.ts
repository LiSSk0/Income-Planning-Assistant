import { create } from 'zustand'

export type Role = 'admin' | 'manager'

interface SessionState {
  user: { login: string; role: Role } | null
  /** Профиль администратора блокируется при параллельном входе. */
  adminLocked: boolean
  login: (login: string, role: Role) => void
  logout: () => void
}

/** Простая сессия (раздел 3.1) — без глубокой безопасности, вне скоупа MVP. */
export const useSessionStore = create<SessionState>((set) => ({
  user: null,
  adminLocked: false,
  login: (login, role) => set({ user: { login, role } }),
  logout: () => set({ user: null }),
}))

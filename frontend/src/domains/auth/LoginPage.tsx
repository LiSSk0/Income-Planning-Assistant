import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { LockKeyhole, ShieldCheck } from 'lucide-react'
import { Button, Card, Field, Input } from '@/shared/ui'
import { useSessionStore, type Role } from '@/shared/store/useSessionStore'
import { AmbientBackground } from '@/app/AmbientBackground'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'

/* Экран входа (раздел 3.1). Один админ загружает данные; его профиль
   блокируется при параллельном входе. Менеджеры — read/analytics режим.
   Это первый экран — допустим лёгкий «дышащий» ambient-фон (раздел 6). */
export function LoginPage() {
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const loginAction = useSessionStore((s) => s.login)
  const [login, setLogin] = useState('admin')
  const [role, setRole] = useState<Role>('admin')
  const [error, setError] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!login.trim()) {
      setError('Введите логин, чтобы продолжить.')
      return
    }
    loginAction(login.trim(), role)
    navigate('/')
  }

  return (
    <div className="relative grid min-h-screen place-items-center px-4">
      <AmbientBackground />
      {/* «Дышащий» градиент-акцент — единственный раз, на первом экране */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[520px] w-[520px] -translate-x-1/2 rounded-full blur-[140px]"
        style={{ background: 'var(--glow-green)' }}
        animate={reduced ? undefined : { scale: [1, 1.12, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={reduced ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl bg-accent-green/15 text-accent-lime">
            <span className="text-2xl font-extrabold">С</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Помощник по планированию доходов</h1>
        </div>

        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Логин" htmlFor="login">
              <Input
                id="login"
                value={login}
                onChange={(e) => {
                  setLogin(e.target.value)
                  setError(null)
                }}
                placeholder="admin"
                autoFocus
              />
            </Field>

            <Field label="Роль" htmlFor="role" hint="Админ загружает данные, менеджер — только аналитика">
              <div className="grid grid-cols-2 gap-2" id="role">
                {(['admin', 'manager'] as Role[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={
                      'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ' +
                      (role === r
                        ? 'border-accent-green/50 bg-accent-green/10 text-text-primary'
                        : 'border-border text-text-secondary hover:bg-surface-hover')
                    }
                  >
                    {r === 'admin' ? <LockKeyhole className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
                    {r === 'admin' ? 'Администратор' : 'Менеджер'}
                  </button>
                ))}
              </div>
            </Field>

            {error && <p className="text-xs text-accent-red">{error}</p>}

            <Button type="submit" size="lg" className="w-full">
              Войти
            </Button>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}

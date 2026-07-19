import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { LogOut, Lock } from 'lucide-react'
import { AmbientBackground } from './AmbientBackground'
import { NAV } from './navigation'
import { cn } from '@/shared/lib/cn'
import { useSessionStore } from '@/shared/store/useSessionStore'
import { usePrefersReducedMotion } from '@/shared/hooks/usePrefersReducedMotion'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { useGraphStore } from '@/domains/business-graph/store/useGraphStore'

export function AppLayout() {
    const location = useLocation()
    const reduced = usePrefersReducedMotion()
    const { user, logout } = useSessionStore()
    const { hasData } = useDatasetStore()
    const { graphViewed } = useGraphStore()

    const navEntries = NAV.filter((entry) => !entry.adminOnly || user?.role === 'admin')

    const isEntryDisabled = (entry: (typeof NAV)[0]) => {
        if (entry.to === '/scenarios' || entry.to === '/ai') {
            return !hasData
        }
        if (entry.to === '/export') {
            // ✅ Экспорт доступен только если есть данные И граф был просмотрен
            return !hasData || !graphViewed
        }
        return false
    }

    return (
        <div className="flex min-h-screen text-text-primary">
            <AmbientBackground />

            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-bg-elevated/60 p-4 backdrop-blur-sm lg:flex">
                <div className="mb-8 flex items-center gap-2.5 px-2">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent-green/15 text-accent-lime">
                        <span className="text-lg font-extrabold">С</span>
                    </div>
                    <div className="leading-tight">
                        <div className="text-sm font-bold">Планирование доходов</div>
                        <div className="text-[11px] text-text-secondary">интеллектуальный помощник</div>
                    </div>
                </div>

                <nav className="flex flex-1 flex-col gap-1">
                    {navEntries.map((entry) => {
                        const Icon = entry.icon
                        const disabled = isEntryDisabled(entry)
                        const isActive =
                            location.pathname === entry.to ||
                            (entry.to !== '/' && location.pathname.startsWith(entry.to))

                        return (
                            <div key={entry.to} className="relative group">
                                <NavLink
                                    to={disabled ? '#' : entry.to}
                                    end={entry.to === '/'}
                                    className={({ isActive: active }) =>
                                        cn(
                                            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors w-full',
                                            disabled && 'opacity-40 cursor-not-allowed pointer-events-none',
                                            active || isActive
                                                ? 'bg-surface-card text-text-primary'
                                                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                                        )
                                    }
                                    onClick={(e) => {
                                        if (disabled) {
                                            e.preventDefault()
                                        }
                                    }}
                                >
                                    <Icon
                                        className={cn(
                                            'h-[18px] w-[18px]',
                                            isActive || location.pathname === entry.to ? 'text-accent-lime' : '',
                                        )}
                                        strokeWidth={1.75}
                                    />
                                    <span className="flex flex-col">
                                        <span className="font-medium">{entry.label}</span>
                                        <span className="text-[11px] text-text-muted">
                                            {disabled ? '⚠️ данные не загружены' : entry.hint}
                                        </span>
                                    </span>
                                    {disabled && <Lock className="h-3.5 w-3.5 text-text-muted ml-auto" />}
                                </NavLink>
                            </div>
                        )
                    })}
                </nav>

                {user && (
                    <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5">
                        <div className="leading-tight">
                            <div className="text-sm font-medium">{user.login}</div>
                            <div className="text-[11px] text-text-secondary">
                                {user.role === 'admin' ? 'Администратор' : 'Менеджер'}
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            aria-label="Выйти"
                            className="text-text-muted hover:text-accent-red"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    </div>
                )}
            </aside>

            <main className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={reduced ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduced ? undefined : { opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, ease: 'easeOut' }}
                        className="mx-auto max-w-[1400px] px-5 py-6 md:px-8"
                    >
                        <Outlet />
                    </motion.div>
                </AnimatePresence>
            </main>
        </div>
    )
}
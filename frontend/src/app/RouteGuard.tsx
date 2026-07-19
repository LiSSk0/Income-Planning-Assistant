import { ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { useGraphStore } from '@/domains/business-graph/store/useGraphStore'
import { Card, CardBody, EmptyState } from '@/shared/ui'
import { Database, Workflow } from 'lucide-react'

interface Props {
    children: ReactNode
    /** Требует ли страница наличия данных */
    requiresData?: boolean
    /** Требует ли страница сохранённого графа */
    requiresGraph?: boolean
    /** Альтернативный контент вместо редиректа (например, блокировка с сообщением) */
    fallback?: ReactNode
}

/**
 * Guard для страниц, требующих данные или граф.
 * Если данных нет - блокирует доступ с сообщением.
 * Если граф не сохранён - блокирует доступ с сообщением.
 */
export function RouteGuard({ children, requiresData = false, requiresGraph = false, fallback }: Props) {
    const location = useLocation()
    const { hasData, loading } = useDatasetStore()
    const { hasSaved } = useGraphStore()

    // Если данные ещё загружаются - показываем заглушку
    if (loading) {
        return (
            <Card>
                <CardBody className="flex items-center justify-center py-16">
                    <div className="flex items-center gap-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent-green border-t-transparent" />
                        <span className="text-text-secondary">Загрузка данных...</span>
                    </div>
                </CardBody>
            </Card>
        )
    }

    // Если требуется граф, но он не сохранён
    if (requiresGraph && !hasSaved) {
        if (fallback) return <>{fallback}</>
        return (
            <Card>
                <CardBody className="py-16">
                    <EmptyState
                        icon={<Workflow className="h-10 w-10" />}
                        title="Граф не сохранён"
                        description="Для работы с этой страницей необходимо сохранить граф бизнес-модели. Перейдите на вкладку «Граф бизнес-модели», соберите зависимости и сохраните."
                    />
                </CardBody>
            </Card>
        )
    }

    // Если требуются данные, но их нет
    if (requiresData && !hasData) {
        if (fallback) return <>{fallback}</>
        return (
            <Card>
                <CardBody className="py-16">
                    <EmptyState
                        icon={<Database className="h-10 w-10" />}
                        title="Нет загруженных данных"
                        description="Для работы с этой страницей необходимо загрузить данные. Перейдите на вкладку «Загрузка данных» и загрузите Excel/CSV файл."
                    />
                </CardBody>
            </Card>
        )
    }

    return <>{children}</>
}
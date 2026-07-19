import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'
import { RouteGuard } from './RouteGuard'
import { LoginPage } from '@/domains/auth/LoginPage'
import { OverviewPage } from '@/domains/overview/OverviewPage'
import { UploadPage } from '@/domains/data-ingestion/UploadPage'
import { BusinessGraphPage } from '@/domains/business-graph/BusinessGraphPage'
import { ScenariosPage } from '@/domains/scenarios/ScenariosPage'
import { AiInsightsPage } from '@/domains/ai-insights/AiInsightsPage'
import { ExportPage } from '@/domains/export/ExportPage'

export const router = createBrowserRouter([
    { path: '/login', element: <LoginPage /> },
    {
        path: '/',
        element: (
            <RequireAuth>
                <AppLayout />
            </RequireAuth>
        ),
        children: [
            // Текущие данные - всегда доступны (показывают что загружено)
            { index: true, element: <OverviewPage /> },

            // Загрузка - всегда доступна для админа
            {
                path: 'upload',
                element: (
                    <RequireAuth role="admin">
                        <UploadPage />
                    </RequireAuth>
                ),
            },

            // Граф - доступен всегда (может быть пустым)
            { path: 'graph', element: <BusinessGraphPage /> },

            // Сценарии - требуют данные
            {
                path: 'scenarios',
                element: (
                    <RouteGuard requiresData>
                        <ScenariosPage />
                    </RouteGuard>
                ),
            },

            // AI-аналитика - требует данные
            {
                path: 'ai',
                element: (
                    <RouteGuard requiresData>
                        <AiInsightsPage />
                    </RouteGuard>
                ),
            },

            // Экспорт - требует данные И сохранённый граф
            {
                path: 'export',
                element: (
                    <RouteGuard requiresData requiresGraph>
                        <ExportPage />
                    </RouteGuard>
                ),
            },
        ],
    },
])
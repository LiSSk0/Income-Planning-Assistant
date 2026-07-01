import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './AppLayout'
import { RequireAuth } from './RequireAuth'
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
      { index: true, element: <OverviewPage /> },
      {
        path: 'upload',
        element: (
          <RequireAuth role="admin">
            <UploadPage />
          </RequireAuth>
        ),
      },
      { path: 'graph', element: <BusinessGraphPage /> },
      { path: 'scenarios', element: <ScenariosPage /> },
      { path: 'ai', element: <AiInsightsPage /> },
      { path: 'export', element: <ExportPage /> },
    ],
  },
])

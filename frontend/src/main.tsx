import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import { startMockWorker } from './mocks/browser'
import './index.css'

async function bootstrap() {
  // Поднимаем MSW, чтобы фронт работал автономно без бэка.
  await startMockWorker()
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

bootstrap()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './app/router'
import './index.css'

async function bootstrap() {
    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <RouterProvider router={router} />
        </StrictMode>,
    )
}

bootstrap()
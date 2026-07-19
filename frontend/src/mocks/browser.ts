import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

/** Запускает MSW. Вызывается в main.tsx до рендера приложения. */
export async function startMockWorker() {
  await worker.start({
    onUnhandledRequest: 'bypass',
    quiet: true,
  })
}

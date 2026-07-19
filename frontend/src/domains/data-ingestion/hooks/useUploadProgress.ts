import { useCallback, useEffect, useRef, useState } from 'react'
import type { UploadPhase, UploadProgressEvent } from '@/shared/lib/api-types'

/* ============================================================
   Хук имитации асинхронного пайплайна загрузки.

   В ПРОДЕ (фаза 5) тело старта заменяется на нативный WebSocket:

     const ws = new WebSocket(`${WS_BASE}/uploads/${uploadId}`)
     ws.onmessage = (e) => applyEvent(JSON.parse(e.data) as UploadProgressEvent)
     ws.onerror / ws.onclose → реконнект с экспоненциальной задержкой,
       а при N неудачных попытках — fallback на polling
       GET /api/uploads/:id/progress каждые ~1с.

   Чтобы замена была ЛОКАЛЬНОЙ, вся остальная логика хука работает
   поверх единого обработчика события applyEvent(UploadProgressEvent),
   а здесь мы лишь синтезируем эти события таймером.
   ============================================================ */

/** Упорядоченные фазы пайплайна (без 'error' — это терминальное состояние). */
const PHASES: Exclude<UploadPhase, 'error'>[] = [
  'queued',
  'parsing',
  'validating',
  'detecting-entities',
  'persisting',
  'done',
]

const PHASE_MESSAGE: Record<UploadPhase, string> = {
  queued: 'Файл поставлен в очередь обработки…',
  parsing: 'Разбор структуры файла и чтение строк…',
  validating: 'Проверка форматов периодов, территорий и значений…',
  'detecting-entities': 'Автоопределение сущностей по колонкам…',
  persisting: 'Сохранение нормализованных фактов…',
  done: 'Готово. Данные загружены и размечены.',
  error: 'Не удалось обработать файл. Проверьте структуру и повторите.',
}

/** Доля общего прогресса (0..1), на которой ЗАВЕРШАЕТСЯ каждая фаза. */
const PHASE_BOUNDARY: Record<Exclude<UploadPhase, 'error'>, number> = {
  queued: 8,
  parsing: 35,
  validating: 55,
  'detecting-entities': 78,
  persisting: 97,
  done: 100,
}

interface UploadState {
  percent: number
  phase: UploadPhase
  message: string
  fileName: string | null
}

const INITIAL: UploadState = {
  percent: 0,
  phase: 'queued',
  message: 'Ожидание файла…',
  fileName: null,
}

const TICK_MS = 60
/** Полный прогон ~3.6с (60 шагов × 60мс), монотонно. */
const STEP_MAX = 2.0
const STEP_MIN = 0.8

export interface UseUploadProgress {
  percent: number
  phase: UploadPhase
  message: string
  fileName: string | null
  /** Запустить пайплайн для выбранного файла. */
  start: (file: File) => void
  /** Сброс к idle. */
  reset: () => void
}

export function useUploadProgress(): UseUploadProgress {
  const [state, setState] = useState<UploadState>(INITIAL)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const percentRef = useRef(0)

  const clear = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  /** Единая точка применения события прогресса — в проде её дёргает ws.onmessage.
   *  Сейчас вызывается из таймера-симулятора, в фазе 5 — из WebSocket. */
  const applyEvent = useCallback((ev: UploadProgressEvent) => {
    setState((prev) => ({
      percent: ev.percent,
      phase: ev.phase,
      message: ev.message,
      fileName: prev.fileName,
    }))
  }, [])

  const reset = useCallback(() => {
    clear()
    percentRef.current = 0
    setState(INITIAL)
  }, [clear])

  const start = useCallback(
    (file: File) => {
      clear()
      percentRef.current = 0
      setState({
        percent: 0,
        phase: 'queued',
        message: PHASE_MESSAGE.queued,
        fileName: file.name,
      })

      timerRef.current = setInterval(() => {
        const next = Math.min(
          100,
          percentRef.current + STEP_MIN + Math.random() * (STEP_MAX - STEP_MIN),
        )
        percentRef.current = next

        // Текущая фаза = первая, чья граница ещё не достигнута.
        const phase =
          PHASES.find((p) => next < PHASE_BOUNDARY[p]) ??
          (next >= 100 ? 'done' : 'persisting')

        // Синтезируем событие — в проде это пришло бы из ws.onmessage —
        // и прогоняем через ту же applyEvent, что будет точкой входа для WS.
        applyEvent({
          uploadId: file.name,
          phase,
          percent: next,
          message: PHASE_MESSAGE[phase],
        })

        if (next >= 100) {
          clear()
        }
      }, TICK_MS)
    },
    [applyEvent, clear],
  )

  // Очистка таймера при размонтировании.
  useEffect(() => clear, [clear])

  return {
    percent: state.percent,
    phase: state.phase,
    message: state.message,
    fileName: state.fileName,
    start,
    reset,
  }
}

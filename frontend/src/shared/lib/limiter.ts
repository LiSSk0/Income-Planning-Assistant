/* Лёгкий лимитер параллелизма (паттерн p-limit).
   Раздел 7: бэк держит максимум 5 одновременных потоков — не даём
   фронту настрелять больше тяжёлых запросов одновременно. */
export function createLimiter(maxConcurrent: number) {
  let active = 0
  const queue: Array<() => void> = []

  const next = () => {
    if (active >= maxConcurrent) return
    const run = queue.shift()
    if (run) run()
  }

  function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active++
        task()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      }
      queue.push(run)
      next()
    })
  }

  return {
    schedule,
    get active() {
      return active
    },
    get pending() {
      return queue.length
    },
  }
}

/** Общий лимитер тяжёлых запросов (пересчёт сценариев, загрузка). */
export const heavyLimiter = createLimiter(5)

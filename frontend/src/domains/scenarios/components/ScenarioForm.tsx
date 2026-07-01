import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sparkles } from 'lucide-react'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Select,
  Input,
  Field,
} from '@/shared/ui'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import type { CalcMethod, ScenarioParams } from '@/shared/lib/api-types'
import { useScenarioStore } from '../store/useScenarioStore'

/* Форма генерации варианта плана. Период планирования — отрезок [с..по]
   (до 24 мес). Сезонность учитывается всегда. Ключевой переключатель —
   МЕТОД расчёта (среднее за 3/6 мес / по темпам роста). */

const METHOD_OPTIONS: { value: CalcMethod; label: string }[] = [
  { value: 'growth-rate', label: 'По темпам роста' },
  { value: 'avg-3m', label: 'Среднее за 3 мес' },
  { value: 'avg-6m', label: 'Среднее за 6 мес' },
]

const schema = z
  .object({
    name: z.string().trim().min(1, 'Введите название плана').max(60, 'Слишком длинное название'),
    targetIndicator: z.string().min(1, 'Выберите показатель'),
    periodFrom: z.coerce
      .number({ invalid_type_error: 'Укажите месяц' })
      .int('Только целое число')
      .min(1, 'Минимум 1')
      .max(24, 'Максимум 24'),
    periodTo: z.coerce
      .number({ invalid_type_error: 'Укажите месяц' })
      .int('Только целое число')
      .min(1, 'Минимум 1')
      .max(24, 'Максимум 24'),
    method: z.enum(['growth-rate', 'avg-3m', 'avg-6m']),
  })
  .refine((v) => v.periodTo >= v.periodFrom, {
    message: 'Конец периода должен быть не меньше начала',
    path: ['periodTo'],
  })

type FormValues = z.infer<typeof schema>

const DEFAULT_INDICATOR = 'Доход банка'

export function ScenarioForm() {
  const { indicators, loadFacts, loading } = useDatasetStore()
  const compute = useScenarioStore((s) => s.compute)
  // Идёт ли сейчас хотя бы один пересчёт — блокируем повторную отправку.
  const computingNow = useScenarioStore((s) =>
    s.scenarios.some((sc) => sc.status === 'queued' || sc.status === 'computing'),
  )

  useEffect(() => {
    loadFacts()
  }, [loadFacts])

  const indicatorOptions = useMemo(() => {
    if (indicators.length) return indicators
    return [DEFAULT_INDICATOR]
  }, [indicators])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      targetIndicator: DEFAULT_INDICATOR,
      periodFrom: 1,
      periodTo: 6,
      method: 'avg-3m',
    },
  })

  const onSubmit = async (values: FormValues) => {
    const params: ScenarioParams = {
      name: values.name,
      targetIndicator: values.targetIndicator,
      // Период — отрезок [с..по]; horizonMonths = конец отрезка.
      periodFrom: values.periodFrom,
      horizonMonths: values.periodTo,
      method: values.method,
      seasonality: true, // сезонность учитывается всегда
    }
    await compute(params)
  }

  const busy = isSubmitting || computingNow

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новый вариант плана</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Название плана" htmlFor="name" error={errors.name?.message}>
            <Input id="name" placeholder="Напр. «Базовый Q3»" {...register('name')} />
          </Field>

          <Field
            label="Период планирования, мес"
            hint="Отрезок от 1 до 24 мес, напр. 6–12"
            error={errors.periodFrom?.message ?? errors.periodTo?.message}
          >
            <div className="flex items-center gap-2">
              <Input
                aria-label="С месяца"
                type="number"
                min={1}
                max={24}
                step={1}
                {...register('periodFrom')}
              />
              <span className="text-text-muted">—</span>
              <Input
                aria-label="По месяц"
                type="number"
                min={1}
                max={24}
                step={1}
                {...register('periodTo')}
              />
            </div>
          </Field>

          <Field label="Метод расчёта" htmlFor="method" error={errors.method?.message}>
            <Select id="method" {...register('method')}>
              {METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" disabled={busy} className="w-full">
            <Sparkles className="h-4 w-4" />
            {busy ? 'Идёт расчёт…' : 'Сгенерировать план'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

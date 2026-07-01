import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Card, CardBody, Field, Select } from '@/shared/ui'
import { DRIVER_SUBJECTS } from '@/mocks/drivers'
import { DriversChart } from './components/DriversChart'

/* Раздел «Аналитика по региону»: выбор субъекта РФ → график драйверов
   перестраивается по выбранному региону. */

export function RegionAnalytics() {
  const [subject, setSubject] = useState<string>(DRIVER_SUBJECTS[0])

  return (
    <section className="space-y-3">
      {/* Выпадающий список выбора региона */}
      <Card>
        <CardBody className="flex flex-wrap items-end gap-4 py-4">
          <div className="w-full max-w-xs">
            <Field label="Субъект РФ" htmlFor="region-select">
              <Select
                id="region-select"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
              >
                {DRIVER_SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <p className="flex items-center gap-1.5 pb-2 text-xs text-text-muted">
            <MapPin className="h-3.5 w-3.5" />
            Выбор региона перестраивает график драйверов
          </p>
        </CardBody>
      </Card>

      {/* График драйверов по выбранному региону */}
      <DriversChart subject={subject} />
    </section>
  )
}

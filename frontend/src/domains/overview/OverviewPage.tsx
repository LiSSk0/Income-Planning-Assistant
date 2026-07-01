import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ArrowRight, Users, Wallet, Receipt, Percent } from 'lucide-react'
import { Button, Card, CardBody, CardHeader, CardTitle, KpiStat, Skeleton } from '@/shared/ui'
import { PageHeader } from '@/shared/ui/PageHeader'
import { useDatasetStore } from '@/shared/store/useDatasetStore'
import { aggregateByPeriod, lastDeltaPct, lastValue } from '@/shared/lib/selectors'
import { formatPeriod, formatNumber } from '@/shared/lib/format'
import { chartTheme } from '@/shared/ui/chartTheme'
import { RegionAnalytics } from '@/domains/analytics/RegionAnalytics'

export function OverviewPage() {
  const { facts, loading, loadFacts } = useDatasetStore()

  useEffect(() => {
    loadFacts()
  }, [loadFacts])

  const revenue = useMemo(() => aggregateByPeriod(facts, 'Доход банка'), [facts])
  const clients = useMemo(() => aggregateByPeriod(facts, 'Количество клиентов'), [facts])
  const tx = useMemo(() => aggregateByPeriod(facts, 'Объём транзакций'), [facts])
  const share = useMemo(() => aggregateByPeriod(facts, 'Доля питающихся в столовой'), [facts])

  const chartData = revenue.map((p) => ({ period: formatPeriod(p.period), Доход: p.value }))

  return (
    <div>
      <PageHeader
        title="Текущие данные"
        subtitle="Данные, загруженные из файла: сводка по доходу и ключевым драйверам по регионам."
        actions={
          <Link to="/graph">
            <Button variant="secondary" size="sm">
              К графу модели <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiStat
            label="Доход банка (Σ регионы)"
            value={lastValue(revenue)}
            unit="руб"
            fractionDigits={0}
            deltaPct={lastDeltaPct(revenue)}
            icon={<Wallet className="h-4 w-4" />}
          />
          <KpiStat
            label="Объём транзакций"
            value={lastValue(tx)}
            unit="руб"
            deltaPct={lastDeltaPct(tx)}
            icon={<Receipt className="h-4 w-4" />}
          />
          <KpiStat
            label="Количество клиентов"
            value={lastValue(clients)}
            unit="чел"
            deltaPct={lastDeltaPct(clients)}
            icon={<Users className="h-4 w-4" />}
          />
          <KpiStat
            label="Доля питающихся (Σ)"
            value={lastValue(share)}
            unit="%"
            deltaPct={lastDeltaPct(share)}
            icon={<Percent className="h-4 w-4" />}
          />
        </div>
      )}

      <Card className="mt-4">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Динамика дохода по месяцам</CardTitle>
          <span className="tabular text-xs text-text-secondary">
            последнее: {formatNumber(lastValue(revenue))} руб
          </span>
        </CardHeader>
        <CardBody>
          {loading ? (
            <Skeleton className="h-72 w-full" />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartTheme.green} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={chartTheme.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="period" {...chartTheme.axis} />
                  <YAxis {...chartTheme.axis} width={70} tickFormatter={(v) => formatNumber(v, 0)} />
                  <Tooltip {...chartTheme.tooltip} formatter={(v: number) => [formatNumber(v) + ' руб', 'Доход']} />
                  <Area
                    type="monotone"
                    dataKey="Доход"
                    stroke={chartTheme.green}
                    strokeWidth={2}
                    fill="url(#revFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Аналитика по региону (task_week1, блоки 2–3):
          выбор субъекта РФ → график драйверов + AI-подсказки. */}
      <div className="mt-6">
        <h2 className="mb-3 text-lg font-bold tracking-tight text-text-primary">
          Аналитика по региону
        </h2>
        <RegionAnalytics />
      </div>
    </div>
  )
}

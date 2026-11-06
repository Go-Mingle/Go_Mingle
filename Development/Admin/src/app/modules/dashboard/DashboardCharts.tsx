import { useTranslation } from 'react-i18next'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { mockBookingsChart } from '../../../mocks/data/index'

interface PieEntry {
  name: string
  value: number
  fill: string
}

interface RevenueData {
  commissions: number
  penalties: number
  total: number
  trend: string
}

interface DashboardChartsProps {
  revenueData?: RevenueData
}

export function DashboardCharts({ revenueData }: DashboardChartsProps) {
  const { t } = useTranslation('dashboard')

  const pieData: PieEntry[] = revenueData
    ? [
        {
          name: t('commissions'),
          value: revenueData.commissions,
          fill: 'var(--color-accent)',
        },
        {
          name: t('penaltyFees'),
          value: revenueData.penalties,
          fill: 'var(--color-coral)',
        },
      ]
    : []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Bookings Bar Chart */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">{t('bookings')}</h2>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              {t('total', {
                count: mockBookingsChart.reduce((s, d) => s + d.count, 0),
              })}
            </p>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={mockBookingsChart} barSize={28}>
            <XAxis
              dataKey="day"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {mockBookingsChart.map((_, i) => (
                <Cell key={i} fill="var(--color-accent)" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Revenue by Source — Donut */}
      <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-6 shadow-[var(--shadow-sm)]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
              {t('revenueBySource')}
            </h2>
            <p className="text-[12px] text-[var(--color-text-muted)]">
              {t('revenueBySourceSubtitle')}
            </p>
          </div>
          {revenueData && (
            <span className="text-[11px] font-semibold bg-[var(--color-accent-light)] text-[var(--color-accent)] px-2 py-1 rounded-[100px]">
              {t('totalPkr', { amount: revenueData.total.toLocaleString() })}
            </span>
          )}
        </div>
        {revenueData && (
          <div className="flex gap-4 items-center">
            <ResponsiveContainer width={140} height={140}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={65}
                  paddingAngle={3}
                >
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="flex-1 space-y-3">
              {pieData.map((d) => (
                <div key={d.name} className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-[2px] shrink-0"
                    style={{ backgroundColor: d.fill }}
                  />
                  <span className="flex-1 text-[12px] text-[var(--color-text-muted)]">
                    {d.name}
                  </span>
                  <span className="text-[12px] font-semibold text-[var(--color-text)]">
                    PKR {d.value.toLocaleString()}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-[var(--color-divider)] flex justify-between">
                <span className="text-[11px] text-[var(--color-text-muted)]">{t('trend')}</span>
                <span className="text-[12px] font-semibold text-[var(--color-accent)]">
                  {revenueData.trend}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

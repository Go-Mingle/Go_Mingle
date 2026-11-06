import { useTranslation } from 'react-i18next'
import { Spin, Alert } from 'antd'
import { ForkKnife, ClipboardText, Users, TrendUp } from '@phosphor-icons/react'
import { PageHeader } from '../../molecules/PageHeader'
import { KpiCard } from './KpiCard'
import { TopRestaurantsWidget, ApprovalQueueWidget } from './DashboardWidgets'
import { DashboardCharts } from './DashboardCharts'
import { useDashboardRevenueQuery } from './hooks/useDashboardQuery'

type PeriodKey = 'today' | 'thisWeek' | 'thisMonth'

const ACTIVE_RESTAURANTS_VALUE: Record<PeriodKey, string | number> = {
  today: 2,
  thisWeek: 6,
  thisMonth: 18,
}
const ACTIVE_RESTAURANTS_TREND: Record<PeriodKey, string> = {
  today: '+1 new today',
  thisWeek: '+3 vs last week',
  thisMonth: '+22% vs last month',
}
const PENDING_APPROVALS_VALUE: Record<PeriodKey, string | number> = {
  today: 2,
  thisWeek: 4,
  thisMonth: 7,
}
const PENDING_APPROVALS_TREND: Record<PeriodKey, string> = {
  today: 'Oldest 6h',
  thisWeek: 'Oldest 1d',
  thisMonth: 'Oldest 3d',
}
const ACTIVE_MINGLERS_VALUE: Record<PeriodKey, string | number> = {
  today: 124,
  thisWeek: 891,
  thisMonth: 3420,
}
const ACTIVE_MINGLERS_TREND: Record<PeriodKey, string> = {
  today: '+8 active today',
  thisWeek: '+14% vs last week',
  thisMonth: '+18% vs last month',
}
const EARNINGS_VALUE: Record<PeriodKey, string | number> = {
  today: 'PKR 8,420',
  thisWeek: 'PKR 52,840',
  thisMonth: 'PKR 191,400',
}
const EARNINGS_TREND: Record<PeriodKey, string> = {
  today: '+12% vs yesterday',
  thisWeek: '+8% vs last week',
  thisMonth: '+22% vs last month',
}

export function DashboardPage() {
  const { t } = useTranslation('dashboard')

  const { data: revenueData, isPending, isError } = useDashboardRevenueQuery()

  if (isPending) return <Spin className="flex justify-center mt-20" />
  if (isError) return <Alert type="error" message={t('common:errors.fetchError')} className="m-4" />

  return (
    <div>
      <PageHeader section={t('section')} title={t('title')} />

      {/* Row 1 — KPI Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <KpiCard
          label={t('activeRestaurants')}
          icon={<ForkKnife size={16} />}
          valueByPeriod={ACTIVE_RESTAURANTS_VALUE}
          trendByPeriod={ACTIVE_RESTAURANTS_TREND}
        />
        <KpiCard
          label={t('pendingApprovals')}
          icon={<ClipboardText size={16} />}
          valueByPeriod={PENDING_APPROVALS_VALUE}
          trendByPeriod={PENDING_APPROVALS_TREND}
          trendColor="muted"
        />
        <KpiCard
          label={t('activeMinglers')}
          icon={<Users size={16} />}
          valueByPeriod={ACTIVE_MINGLERS_VALUE}
          trendByPeriod={ACTIVE_MINGLERS_TREND}
        />
        <KpiCard
          label={`${t('earnings')} (PKR)`}
          icon={<TrendUp size={16} />}
          valueByPeriod={EARNINGS_VALUE}
          trendByPeriod={EARNINGS_TREND}
        />
      </div>

      {/* Row 2 — Top Restaurants + Approval Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <TopRestaurantsWidget />
        <ApprovalQueueWidget />
      </div>

      {/* Row 3 — Charts */}
      <DashboardCharts revenueData={revenueData} />
    </div>
  )
}

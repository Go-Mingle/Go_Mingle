import { useState } from 'react'
import { Alert, Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { InsightsDashboard } from '../../visual/InsightsDashboard'
import { PageSkeleton } from '../../visual/PageSkeleton'
import type { Range } from '../../visual/insights'
import { useDashboardQuery } from './useDashboardQuery'

/** The platform dashboard: bookings, seats and money across every restaurant. */
export function DashboardPage() {
  const { t } = useTranslation('dashboard')
  const [range, setRange] = useState<Range>(30)
  const { data, isPending, isError, refetch } = useDashboardQuery(range)

  if (isPending) return <PageSkeleton variant="cards" count={4} label={t('title')} />
  if (isError || !data) {
    return (
      <Alert
        type="error"
        showIcon
        title={t('loadFailed')}
        action={
          <Button size="small" onClick={() => void refetch()}>
            {t('retry')}
          </Button>
        }
      />
    )
  }
  return (
    <InsightsDashboard
      audience="admin"
      data={data}
      range={range}
      onRange={setRange}
      tableHref={(table) => `/interest-tables/${table.id}`}
    />
  )
}

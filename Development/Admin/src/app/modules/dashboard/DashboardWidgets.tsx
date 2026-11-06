import { useState } from 'react'
import { Select, Input } from 'antd'
import { Link } from 'react-router-dom'
import { X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { StatusBadge } from '../../atoms/StatusBadge'
import type { StatusVariant } from '../../atoms/StatusBadge'
import { mockRestaurants, mockApplications } from '../../../mocks/data/index'

export function TopRestaurantsWidget() {
  const { t } = useTranslation('dashboard')

  const PERIOD_OPTIONS = [
    { value: 'today', label: t('periods.today') },
    { value: 'week', label: t('periods.thisWeek') },
    { value: 'month', label: t('periods.thisMonth') },
    { value: 'all', label: t('periods.allTime') },
  ]
  const [topPeriod, setTopPeriod] = useState('week')
  const topRestaurants = [...mockRestaurants]
    .sort((a, b) => b.grossSales - a.grossSales)
    .slice(0, 5)

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
            {t('topRestaurants')}
          </h2>
          <p className="text-[12px] text-[var(--color-text-muted)]">
            {t('topRestaurantsSubtitle')}
          </p>
        </div>
        <Select
          value={topPeriod}
          onChange={setTopPeriod}
          options={PERIOD_OPTIONS}
          size="small"
          className="w-[120px]"
        />
      </div>
      <div className="space-y-0">
        {topRestaurants.map((r, i) => (
          <div
            key={r.id}
            className="flex items-center gap-3 py-3 border-b border-[var(--color-divider)] last:border-0"
          >
            <span className="text-[13px] font-semibold text-[var(--color-text-muted)] w-5 shrink-0">
              {i + 1}
            </span>
            <div className="w-8 h-8 rounded-[6px] shrink-0" style={{ backgroundColor: r.color }} />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--color-text)] truncate">
                {r.name}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                PKR {r.grossSales.toLocaleString()} revenue · {r.bookings} bookings
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ApprovalQueueWidget() {
  const { t } = useTranslation('dashboard')
  const [queueSearch, setQueueSearch] = useState('')
  const filteredApps = mockApplications.filter(
    (a) =>
      a.name.toLowerCase().includes(queueSearch.toLowerCase()) ||
      a.owner.toLowerCase().includes(queueSearch.toLowerCase()),
  )

  return (
    <div className="bg-[var(--color-card)] border border-[var(--color-border)] rounded-[10px] p-6 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-[16px] font-semibold text-[var(--color-text)]">
            {t('approvalQueue')}
          </h2>
          <p className="text-[12px] text-[var(--color-text-muted)]">{t('approvalQueueSubtitle')}</p>
        </div>
        <Link
          to="/approval-queue"
          className="text-[12px] text-[var(--color-accent)] font-medium hover:underline whitespace-nowrap"
        >
          {t('openQueue')}
        </Link>
      </div>
      <div className="flex items-center justify-between mb-3">
        <Input
          value={queueSearch}
          onChange={(e) => setQueueSearch(e.target.value)}
          placeholder={t('widgets.search')}
          size="small"
          className="h-8 rounded-[6px] w-[60%]"
          allowClear
        />
        <span className="text-[11px] text-[var(--color-text-subtle)]">
          {t('widgets.of', { count: filteredApps.length, total: mockApplications.length })}
        </span>
      </div>
      <div className="space-y-0">
        {filteredApps.slice(0, 4).map((app) => (
          <div
            key={app.id}
            className="flex items-center gap-3 py-3 border-b border-[var(--color-divider)] last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--color-text)] truncate">
                {app.name}
              </p>
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {app.cuisine} · {app.owner}
              </p>
            </div>
            <StatusBadge variant={app.status as StatusVariant} />
            <button className="w-7 h-7 rounded-full flex items-center justify-center text-[var(--color-error)] hover:bg-[var(--color-error-bg)] transition-colors">
              <X size={14} />
            </button>
            <button className="btn-primary text-[11px] font-semibold px-3 h-7">
              {t('common:buttons.approve')}
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

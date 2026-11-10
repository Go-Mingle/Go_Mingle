import { useState } from 'react'
import { Segmented } from 'antd'
import { useTranslation } from 'react-i18next'

type PeriodKey = 'today' | 'thisWeek' | 'thisMonth'

export interface KpiCardProps {
  label: string
  icon: React.ReactNode
  valueByPeriod: Record<PeriodKey, string | number>
  trendByPeriod: Record<PeriodKey, string>
  trendColor?: 'accent' | 'muted'
}

export function KpiCard({
  label,
  icon,
  valueByPeriod,
  trendByPeriod,
  trendColor = 'accent',
}: KpiCardProps) {
  const { t } = useTranslation('dashboard')

  const SEGMENT_OPTIONS = [t('periods.today'), t('periods.thisWeek'), t('periods.thisMonth')]
  const SEGMENT_TO_KEY: Record<string, PeriodKey> = {
    [t('periods.today')]: 'today',
    [t('periods.thisWeek')]: 'thisWeek',
    [t('periods.thisMonth')]: 'thisMonth',
  }

  const [seg, setSeg] = useState(t('periods.thisWeek'))
  const periodKey = SEGMENT_TO_KEY[seg]
  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 flex flex-col gap-3 shadow-[var(--shadow-sm)]">
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          {label}
        </span>
        <div className="w-8 h-8 rounded-full bg-[var(--color-accent-light)] flex items-center justify-center text-[var(--color-accent)]">
          {icon}
        </div>
      </div>
      <p className="text-[28px] font-bold text-[var(--color-text)] leading-none">
        {valueByPeriod[periodKey]}
      </p>
      <p
        className={
          trendColor === 'accent'
            ? 'text-[12px] text-[var(--color-accent)]'
            : 'text-[12px] text-[var(--color-text-muted)]'
        }
      >
        {trendByPeriod[periodKey]}
      </p>
      <div className="mt-auto pt-2 border-t border-[var(--color-divider)]">
        <Segmented
          options={SEGMENT_OPTIONS}
          value={seg}
          onChange={(v) => setSeg(v as string)}
          size="small"
          block
          style={{ fontSize: 10, fontWeight: 600 }}
        />
      </div>
    </div>
  )
}

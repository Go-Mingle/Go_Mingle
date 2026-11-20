import { Alert, Tag } from 'antd'
import { Timer } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { PageSkeleton } from '../../visual/PageSkeleton'
import { useTimerSettingsQuery } from './hooks/useTimerSettingsQuery'
import type { PlatformTimer } from './services'

/**
 * Every timer the platform runs and its value (GM-342). The booking windows are
 * platform-fixed in the requirements, so this screen explains them rather than
 * offering to change them; a restaurant's own cancellation window is set on
 * its No-show policy.
 */
export function TimerSettingsPage() {
  const { t } = useTranslation('timer-settings')
  const { data, isPending, isError } = useTimerSettingsQuery()

  if (isPending) return <PageSkeleton variant="cards" count={3} label={t('title')} />
  if (isError) return <Alert type="error" showIcon message={t('loadingError')} />

  const timers = Array.isArray(data) ? data : []
  const groups = [...new Set(timers.map((x) => x.group))]

  return (
    <div>
      <div className="mb-6">
        <h1 className="m-0 font-[var(--font-display)] text-[20px] font-bold text-[var(--color-text)] md:text-[26px]">
          {t('title')}
        </h1>
        <p className="mt-1 mb-0 max-w-[720px] text-[13px] text-[var(--color-text-muted)]">
          {t('intro')}
        </p>
      </div>
      {timers.length === 0 && <p className="text-[var(--color-text-muted)]">{t('description')}</p>}
      <div className="flex flex-col gap-6">
        {groups.map((g) => (
          <section key={g} aria-labelledby={`timers-${g}`}>
            <h2
              id={`timers-${g}`}
              className="mt-0 mb-3 text-[15px] font-semibold text-[var(--color-text)]"
            >
              {g}
            </h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {timers
                .filter((x) => x.group === g)
                .map((x) => (
                  <TimerCard key={x.key} timer={x} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

function TimerCard({ timer }: { timer: PlatformTimer }) {
  const { t } = useTranslation('timer-settings')
  return (
    <article
      className="flex flex-col gap-2 rounded-[var(--radius-lg)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)]"
      data-testid={`timer-${timer.key}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-[var(--color-text)]">
          <Timer size={18} className="text-[var(--color-accent)]" aria-hidden />
          {timer.name}
        </span>
        <Tag color={timer.source === 'PLATFORM_FIXED' ? 'default' : 'blue'} className="m-0">
          {timer.source === 'PLATFORM_FIXED' ? t('fixed') : t('perRestaurant')}
        </Tag>
      </div>
      <div className="text-[26px] font-bold leading-tight text-[var(--color-text)]">
        {t(`units.${timer.unit}`, { count: timer.value })}
      </div>
      <p className="m-0 text-[13px] text-[var(--color-text-muted)]">{timer.appliesTo}</p>
    </article>
  )
}

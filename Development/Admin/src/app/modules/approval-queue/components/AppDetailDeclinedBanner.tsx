import { useTranslation } from 'react-i18next'
import { XCircle } from '@phosphor-icons/react'
import type { RejectionEntry } from '../types'

interface AppDetailDeclinedBannerProps {
  rejections: RejectionEntry[]
}

export function AppDetailDeclinedBanner({ rejections }: AppDetailDeclinedBannerProps) {
  const { t } = useTranslation('approval-queue')

  if (rejections.length === 0) return null

  const [latest, ...history] = rejections

  return (
    <div className="flex flex-col gap-3 rounded-(--radius-lg) border border-(--color-error-border) bg-(--color-error-bg) px-6 py-5 mb-6">
      <div className="flex items-start gap-3">
        <XCircle size={20} className="text-(--color-error) shrink-0 mt-0.5" />
        <div className="flex flex-col">
          <span className="text-sm font-bold text-(--color-error)">
            {t('detail.declinedTitle')}
          </span>
          <span className="text-xs text-(--color-text-muted) mt-0.5">
            {t('detail.declinedOn', { date: latest.rejectedAt })}
            {latest.rejectedBy ? ` · ${t('detail.rejectedBy', { name: latest.rejectedBy })}` : ''}
          </span>
          <p className="text-[13px] text-(--color-text-secondary) mt-1.5 mb-0 border-l-[3px] border-(--color-error-border) pl-2.5">
            {latest.reason}
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="flex flex-col gap-2 pl-8">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-(--color-text-subtle)">
            {t('detail.rejectionHistory')}
          </span>
          {history.map((r, i) => (
            <div key={`${r.rejectedAt}-${i}`} className="flex flex-col">
              <span className="text-xs text-(--color-text-muted)">
                {t('detail.declinedOn', { date: r.rejectedAt })}
                {r.rejectedBy ? ` · ${t('detail.rejectedBy', { name: r.rejectedBy })}` : ''}
              </span>
              <p className="text-[13px] text-(--color-text-secondary) m-0 border-l-[3px] border-(--color-error-border) pl-2.5">
                {r.reason}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

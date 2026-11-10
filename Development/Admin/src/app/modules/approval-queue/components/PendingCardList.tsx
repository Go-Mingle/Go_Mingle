import { Flex, Tooltip } from 'antd'
import { Eye, CheckCircle, XCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Application } from './types'
import {
  CARD_CLS,
  LABEL_CLS,
  VALUE_BASE_CLS,
  getInitials,
  getAvatarColor,
} from './approvalQueueCardUtils'

interface PendingCardListProps {
  data: Application[]
  onApprove: (r: Application) => void
  onReject: (r: Application) => void
  onView: (id: string) => void
}

export function PendingCardList({ data, onApprove, onReject, onView }: PendingCardListProps) {
  const { t } = useTranslation('approval-queue')

  return (
    <div className="approval-queue-card-list">
      {data.map((app) => (
        <div key={app.id} className={CARD_CLS}>
          {/* Row 1: avatar + name/cuisine + badge */}
          <Flex align="flex-start" gap={12}>
            <div
              style={{ background: getAvatarColor(app.name) }}
              className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center text-white text-[13px] font-bold [font-family:var(--font-ui)]"
            >
              {getInitials(app.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-(--color-text) [font-family:var(--font-ui)] whitespace-nowrap overflow-hidden text-ellipsis">
                {app.name}
              </div>
              <div className="text-xs text-(--color-text-muted) [font-family:var(--font-ui)] mt-0.5">
                {app.cuisine}
              </div>
            </div>
            {/* Pending badge */}
            <span className="shrink-0 bg-[#B06000] text-white h-6 px-2.5 rounded-sm text-xs font-semibold [font-family:var(--font-ui)] inline-flex items-center">
              {t('card.pending')}
            </span>
          </Flex>

          {/* Row 2: stacked label (left) / value (right) */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center gap-3">
              <div className={LABEL_CLS}>{t('card.owner')}</div>
              <div className={`${VALUE_BASE_CLS} text-(--color-text-secondary) text-right`}>
                {app.owner}
              </div>
            </div>
            <div className="flex justify-between items-center gap-3">
              <div className={LABEL_CLS}>{t('card.city')}</div>
              <div className={`${VALUE_BASE_CLS} text-(--color-text-secondary) text-right`}>
                {app.city}
              </div>
            </div>
            <div className="flex justify-between items-center gap-3">
              <div className={LABEL_CLS}>{t('card.submitted')}</div>
              <div className={`${VALUE_BASE_CLS} text-(--color-text-muted) text-right`}>
                {app.submitted}
              </div>
            </div>
          </div>

          {/* Row 3: actions — View takes full width, Approve/Decline are icon-only squares */}
          <div className="flex items-center gap-2 pt-2 border-t border-(--color-divider)">
            <button
              onClick={() => onView(app.id)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 bg-(--color-accent-light) text-(--color-accent-dark) border-[1.5px] border-(--color-accent) rounded-xl [font-family:var(--font-ui)] text-xs font-semibold cursor-pointer"
            >
              <Eye size={14} weight="regular" />
              {t('actions.view')}
            </button>
            <Tooltip title={t('actions.approve')}>
              <button
                onClick={() => onApprove(app)}
                aria-label={t('actions.approve')}
                className="shrink-0 w-9 h-9 flex items-center justify-center bg-(--color-success-bg) text-(--color-success) border-[1.5px] border-(--color-success-border) rounded-xl cursor-pointer"
              >
                <CheckCircle size={15} weight="regular" />
              </button>
            </Tooltip>
            <Tooltip title={t('actions.decline')}>
              <button
                onClick={() => onReject(app)}
                aria-label={t('actions.decline')}
                className="shrink-0 w-9 h-9 flex items-center justify-center bg-(--color-error-bg) text-(--color-error) border-[1.5px] border-(--color-error-border) rounded-xl cursor-pointer"
              >
                <XCircle size={15} weight="regular" />
              </button>
            </Tooltip>
          </div>
        </div>
      ))}
    </div>
  )
}

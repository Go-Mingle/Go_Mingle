import { Flex } from 'antd'
import { Eye } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Application } from './types'
import {
  CARD_CLS,
  LABEL_CLS,
  VALUE_BASE_CLS,
  ACTION_BTN_CLS,
  getInitials,
  getAvatarColor,
} from './approvalQueueCardUtils'

interface RejectedCardListProps {
  data: Application[]
  onView: (id: string) => void
}

export function RejectedCardList({ data, onView }: RejectedCardListProps) {
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
            {/* Rejected badge */}
            <span className="shrink-0 bg-[#C0392B] text-white h-6 px-2.5 rounded text-xs font-semibold [font-family:var(--font-ui)] inline-flex items-center border-none">
              {t('card.rejected')}
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
            <div className="flex justify-between items-center gap-3">
              <div className={LABEL_CLS}>{t('card.rejectedOn')}</div>
              <div className={`${VALUE_BASE_CLS} text-(--color-text-muted) text-right`}>
                {app.rejectedOn ?? '—'}
              </div>
            </div>
          </div>

          {/* Row 3: rejection reason */}
          <div>
            <div className={LABEL_CLS}>{t('card.rejectionReason')}</div>
            <div className={`${VALUE_BASE_CLS} text-(--color-text-muted) italic line-clamp-3`}>
              {app.rejectionReason ?? '—'}
            </div>
          </div>

          {/* Row 4: view action */}
          <Flex justify="flex-end" className="pt-2 border-t border-(--color-divider)">
            <button
              className={`${ACTION_BTN_CLS} bg-(--color-accent-light) text-accent-dark border-[1.5px] border-accent`}
              onClick={() => onView(app.id)}
            >
              <Eye size={14} />
              {t('actions.view')}
            </button>
          </Flex>
        </div>
      ))}
    </div>
  )
}

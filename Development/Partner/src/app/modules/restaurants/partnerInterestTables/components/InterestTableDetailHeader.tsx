import { message } from 'antd'
import { ArrowLeft, LinkSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from '../../../../atoms/StatusBadge'
import { AppButton } from '../../../../atoms/AppButton'
import { LabelTag } from '../../../../atoms/LabelTag'
import { displayDate, displayTime, interestTableStatusVariant } from '../format'
import type { InterestTableDetail } from '../types'

/**
 * The detail header.
 *
 * Copy Link is the **only** action. The prototype's Publish, Edit, Delete, Change
 * Promingler, Cancel Table and "Make available for booking" buttons are all gone:
 * every one of them modifies an interest table, which is admin-only (BR-02). The
 * design's "Make available for booking" control was dropped deliberately.
 */
export function InterestTableDetailHeader({ table }: { table: InterestTableDetail }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const navigate = useNavigate()
  const [messageApi, contextHolder] = message.useMessage()

  const copyLink = () => {
    const link = `${window.location.origin}/m/interest-tables/${table.interestTableId}`
    void navigator.clipboard?.writeText(link)
    void messageApi.success(t('restaurants:partnerInterestTables.linkCopied'))
  }

  return (
    <div className="mb-4">
      {contextHolder}

      <button
        type="button"
        onClick={() => void navigate(-1)}
        className="mb-3 inline-flex cursor-pointer items-center gap-1.5 border-none bg-transparent p-0 text-[13px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={15} />
        {t('common:buttons.back')}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-lg)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 truncate text-base font-bold text-[var(--color-text)] md:text-lg">
                {table.name}
              </h1>
              <StatusBadge variant={interestTableStatusVariant(table.status)} />
              {table.inviteOnly && (
                <LabelTag>{t('restaurants:partnerInterestTables.inviteOnly')}</LabelTag>
              )}
            </div>
            <p className="m-0 mt-1 text-[13px] text-[var(--color-text-muted)]">
              {table.topic} · {displayDate(table.startDate)} · {displayTime(table.startTime)}
            </p>
          </div>
        </div>

        {/* Bound to the server's own flag, never derived from status — it is false for
            Cancelled, and the server is the authority (BR-09). */}
        {table.copyLinkEligible && (
          <AppButton variant="neutral" onClick={copyLink}>
            <LinkSimple size={15} />
            {t('restaurants:partnerInterestTables.copyLink')}
          </AppButton>
        )}
      </div>
    </div>
  )
}

import { useTranslation } from 'react-i18next'
import type { DeliveryRowStatus } from '../types'
import { DELIVERY_ROW_STATUS_STYLE } from '../webhookMeta'

/** Solid fill class per row status — matches DELIVERY_ROW_STATUS_STYLE.solid. */
const STATUS_BG_CLASS: Record<DeliveryRowStatus, string> = {
  DELIVERED: 'bg-[var(--color-success)]',
  RETRYING: 'bg-[var(--color-warning)]',
  FAILED_EMAILED: 'bg-[var(--color-error)]',
  FAILED: 'bg-[var(--color-error)]',
  QUEUED: 'bg-[var(--color-text-muted)]',
}

/**
 * Solid status badge — same style as the interest-table status badges.
 *
 * `FAILED_EMAILED` and `FAILED` are both terminal but are not the same thing:
 * the first means the payload was emailed to the restaurant, the second means
 * that fallback failed too. Only the first may say "emailed" — claiming it for
 * the second would send the partner looking in an inbox that has nothing in it.
 *
 * `QUEUED` is not a server status at all — see {@link DeliveryRowStatus}.
 */
export function DeliveryStatusBadge({ status }: { status: DeliveryRowStatus }) {
  const { t } = useTranslation('integrations')
  const style = DELIVERY_ROW_STATUS_STYLE[status]

  return (
    <span
      className={`inline-flex items-center h-6 px-2.5 rounded-[4px] text-[#fff] text-xs font-semibold font-[Poppins,sans-serif] whitespace-nowrap ${STATUS_BG_CLASS[status]}`}
    >
      {t(style.labelKey)}
    </span>
  )
}

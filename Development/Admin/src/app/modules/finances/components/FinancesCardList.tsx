import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FinanceRecord } from './financeTypes'

interface FinancesCardListProps {
  data: FinanceRecord[]
  onView: (record: FinanceRecord) => void
  onMinglerClick: (record: FinanceRecord) => void
}

const LABEL_CLS =
  'text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-subtle)] font-[var(--font-ui)] mb-[3px]'
const VALUE_BASE_CLS = 'text-[13px] font-[var(--font-ui)]'

export const FinancesCardList = memo(function FinancesCardList({
  data,
  onView,
  onMinglerClick,
}: FinancesCardListProps) {
  const { t } = useTranslation('finances')

  return (
    <div className="finances-card-list">
      {data.map((record) => (
        <div
          key={record.id}
          onClick={() => onView(record)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onView(record)
          }}
          className="bg-[var(--color-card)] rounded-xl p-4 flex flex-col gap-3 cursor-pointer transition-[background] duration-150 ease-out hover:bg-[rgba(15,167,157,0.02)]"
        >
          {/* Row 1: avatar + restaurant/mingler */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              style={{ background: record.avatarColor ?? 'var(--color-accent)' }}
              className="w-9 h-9 rounded-lg shrink-0"
            />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--color-text)] font-[var(--font-ui)] whitespace-nowrap overflow-hidden text-ellipsis">
                {record.restaurant}
              </div>
              <div
                role={record.minglerId ? 'button' : undefined}
                onClick={
                  record.minglerId
                    ? (e) => {
                        e.stopPropagation()
                        onMinglerClick(record)
                      }
                    : undefined
                }
                className={`text-xs font-[var(--font-ui)] mt-0.5 ${record.minglerId ? 'text-[var(--color-accent)] cursor-pointer' : 'text-[var(--color-text-muted)] cursor-default'}`}
              >
                {record.mingler}
              </div>
            </div>
          </div>

          {/* Row 2: 2-col grid Booking ID + Date */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className={LABEL_CLS}>{t('card.bookingId')}</div>
              <div className={`${VALUE_BASE_CLS} text-[var(--color-text-secondary)]`}>
                {record.bookingId}
              </div>
            </div>
            <div>
              <div className={LABEL_CLS}>{t('card.date')}</div>
              <div className={`${VALUE_BASE_CLS} text-[var(--color-text-muted)]`}>
                {record.date}
              </div>
            </div>
          </div>

          {/* Row 3: Total Amount */}
          <div className="flex justify-between items-center pt-2.5 border-t border-[var(--color-divider)]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-subtle)] font-[var(--font-ui)]">
              {t('card.totalAmount')}
            </span>
            <span className="text-[15px] font-bold text-[var(--color-text)] font-[var(--font-ui)]">
              PKR {record.totalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
})

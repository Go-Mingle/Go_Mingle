import { useState } from 'react'
import { InputNumber } from 'antd'
import { CheckCircle, UserMinus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../../../molecules/ConfirmModal'
import { displayBill } from '../format'
import type { InterestTableDetailController } from '../hooks/useInterestTableDetail'
import type { InterestTableBookingRow } from '../types'

/**
 * The two check-in confirmations: "Guests Arrived" for the whole table, and a
 * no-show on one booking.
 *
 * Both are final, and a no-show moves money, so each is confirmed first and
 * the copy says what the server will do.
 */
export function CheckInDialogs({ c }: { c: InterestTableDetailController }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <>
      <ConfirmModal
        open={c.arrivalOpen}
        onCancel={c.closeGuestsArrived}
        onConfirm={c.confirmGuestsArrived}
        icon={<CheckCircle size={24} />}
        title={t('restaurants:partnerInterestTables.guestsArrivedTitle')}
        content={t('restaurants:partnerInterestTables.guestsArrivedBody')}
        cancelText={t('common:buttons.close')}
        confirmText={t('restaurants:partnerInterestTables.guestsArrived')}
      />

      {/* Keyed by booking so the seat count starts fresh for each one. */}
      {c.noShowTarget && <NoShowDialog key={c.noShowTarget.bookingId} c={c} row={c.noShowTarget} />}
    </>
  )
}

function NoShowDialog({ c, row }: { c: InterestTableDetailController; row: InterestTableBookingRow }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const seats = row.seats ?? 1
  const [emptySeats, setEmptySeats] = useState<number>(seats)
  const penalty = (row.penaltyPerSeatPkr ?? 0) * emptySeats

  return (
    <ConfirmModal
      open
      danger
      onCancel={c.closeNoShow}
      onConfirm={() => c.confirmNoShow(emptySeats)}
      icon={<UserMinus size={24} />}
      title={t('restaurants:partnerInterestTables.noShowTitle', { name: row.minglerName })}
      cancelText={t('common:buttons.close')}
      confirmText={t('restaurants:partnerInterestTables.noShow')}
      content={
        <span className="flex flex-col gap-3">
          <span>{t('restaurants:partnerInterestTables.noShowBody')}</span>
          <span className="flex items-center justify-center gap-2">
            <label htmlFor="no-show-empty-seats" className="text-[13px] font-medium text-[var(--color-text)]">
              {t('restaurants:partnerInterestTables.noShowEmptySeats')}
            </label>
            <InputNumber
              id="no-show-empty-seats"
              min={1}
              max={seats}
              precision={0}
              value={emptySeats}
              onChange={(value) => setEmptySeats(Math.min(seats, Math.max(1, value ?? seats)))}
            />
            <span className="text-[13px]">{t('restaurants:partnerInterestTables.noShowOfSeats', { count: seats })}</span>
          </span>
          <span className="font-semibold text-[var(--color-text)]">
            {penalty > 0
              ? t('restaurants:partnerInterestTables.noShowPenalty', { amount: displayBill(penalty) })
              : t('restaurants:partnerInterestTables.noShowNoPenalty')}
          </span>
        </span>
      }
    />
  )
}

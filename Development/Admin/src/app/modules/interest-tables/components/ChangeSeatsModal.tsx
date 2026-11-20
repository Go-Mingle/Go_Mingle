import { useState } from 'react'
import { InputNumber, Modal, message } from 'antd'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { httpClient } from '../../../../shared/api/httpClient'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import type { InterestTableBooking } from '../types'

interface Props {
  booking: InterestTableBooking | null
  onClose: () => void
}

/**
 * Changes how many seats a booking holds (GM-342). The API adds or releases
 * one card hold per seat and only adds seats the table still has free.
 */
export function ChangeSeatsModal({ booking, onClose }: Props) {
  const { t } = useTranslation(['interest-tables', 'common'])
  const qc = useQueryClient()
  const [seats, setSeats] = useState<number | null>(null)
  const [messageApi, holder] = message.useMessage()
  const current = booking?.seats ?? 1
  const value = seats ?? current
  const save = useMutation({
    mutationFn: (n: number) =>
      httpClient.patch(`/api/v1/admin/bookings/${encodeURIComponent(booking?.id ?? '')}`, {
        seats: n,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['interest-table'] })
      void qc.invalidateQueries({ queryKey: ['interest-tables'] })
      void qc.invalidateQueries({ queryKey: ['booking'] })
      void messageApi.success(t('interest-tables:seats.saved', { count: value }))
      setSeats(null)
      onClose()
    },
    onError: (e) => void messageApi.error(getApiErrorMessage(e, t('interest-tables:seats.failed'))),
  })

  return (
    <>
      {holder}
      <Modal
        open={!!booking}
        title={t('interest-tables:seats.title', { name: booking?.guest ?? '' })}
        okText={t('common:buttons.saveChanges')}
        cancelText={t('common:buttons.cancel')}
        okButtonProps={{ disabled: value === current, loading: save.isPending }}
        onOk={() => save.mutate(value)}
        onCancel={() => {
          setSeats(null)
          onClose()
        }}
        destroyOnHidden
      >
        <p className="text-[14px] text-[var(--color-text-muted)]">
          {t('interest-tables:seats.body')}
        </p>
        <label className="flex flex-col gap-2 text-[13px] font-semibold">
          {t('interest-tables:seats.label')}
          <InputNumber
            min={1}
            max={20}
            value={value}
            onChange={(v) => setSeats(typeof v === 'number' ? v : null)}
            className="w-40"
          />
        </label>
      </Modal>
    </>
  )
}

import { useState } from 'react'
import { Table, Tag, message } from 'antd'
import type { TableProps } from 'antd/es/table'
import { WarningCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { HttpError } from '../../../../shared/api/httpClient'
import { useResolveFailureMutation, useRetryFailureMutation } from '../hooks/useEscrow'
import type { PaymentFailure } from '../types'
import { ReasonModal } from './EscrowModals'

const formatPkr = (n: number) => `PKR ${n.toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

function apiMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    const body = err.responseBody as { error?: { message?: string } } | null | undefined
    return body?.error?.message || fallback
  }
  return fallback
}

/**
 * Failed collections: no-show penalties and hold releases the gateway refused.
 *
 * Nothing here is retried automatically. An admin retries one (if it goes
 * through, the amount is added to the booking) or closes it with a note, which
 * also releases the card hold so nothing stays reserved on the Mingler's card.
 */
export function FailedCollections({ failures }: { failures: PaymentFailure[] }) {
  const { t } = useTranslation('finances')
  const retry = useRetryFailureMutation()
  const resolve = useResolveFailureMutation()
  const [closing, setClosing] = useState<PaymentFailure | null>(null)

  const label = (f: PaymentFailure) => f.bookingRef ?? `#${String(f.id)}`

  const columns: TableProps<PaymentFailure>['columns'] = [
    {
      title: t('escrow.failures.col.booking'),
      key: 'booking',
      render: (_, f) => (
        <div>
          <div className="font-semibold">{label(f)}</div>
          <div className="text-xs text-(--color-text-muted)">
            {[f.eventName, f.seatNo ? t('escrow.failures.seat', { seat: f.seatNo }) : null].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    { title: t('escrow.failures.col.restaurant'), key: 'restaurant', render: (_, f) => f.restaurantName ?? '—' },
    { title: t('escrow.failures.col.mingler'), key: 'mingler', render: (_, f) => f.minglerName ?? '—' },
    { title: t('escrow.failures.col.what'), key: 'what', render: (_, f) => t(`escrow.failures.action.${f.action}`) },
    {
      title: t('escrow.failures.col.amount'),
      key: 'amount',
      align: 'right',
      render: (_, f) => <span className="tabular-nums">{f.amount === null ? '—' : formatPkr(f.amount)}</span>,
    },
    {
      title: t('escrow.failures.col.reason'),
      key: 'reason',
      render: (_, f) => <span className="text-(--color-error)">{f.message}</span>,
    },
    {
      title: t('escrow.failures.col.when'),
      key: 'when',
      render: (_, f) => (
        <div>
          <div className="whitespace-nowrap">{new Date(f.at).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' })}</div>
          <div className="text-xs text-(--color-text-muted)">{t('escrow.failures.attempts', { count: f.attempts })}</div>
        </div>
      ),
    },
    {
      title: t('escrow.failures.col.actions'),
      key: 'actions',
      render: (_, f) => {
        const busy = retry.isPending && retry.variables === f.id
        return (
          <div className="flex gap-2">
            <AppButton
              variant="primary"
              loading={busy}
              onClick={() =>
                retry.mutate(f.id, {
                  onSuccess: () => void message.success(t('escrow.failures.retried', { ref: label(f) })),
                  onError: (err) => void message.error(apiMessage(err, t('escrow.failures.retryFailed'))),
                })
              }
            >
              {t('escrow.failures.retry')}
            </AppButton>
            <AppButton variant="neutral" disabled={busy} onClick={() => setClosing(f)}>
              {t('escrow.failures.close')}
            </AppButton>
          </div>
        )
      },
    },
  ]

  return (
    <section className="mb-6 rounded-xl border border-(--color-border) bg-(--color-card) p-4" aria-label={t('escrow.failures.title')}>
      <div className="flex flex-wrap items-center gap-2">
        <WarningCircle size={18} weight="fill" className={failures.length ? 'text-(--color-error)' : 'text-(--color-text-muted)'} />
        <h2 className="m-0 text-base font-bold text-(--color-text)">{t('escrow.failures.title')}</h2>
        {failures.length > 0 && <Tag color="red">{t('escrow.failures.count', { count: failures.length })}</Tag>}
      </div>
      <p className="m-0 mt-1 text-sm text-(--color-text-muted)">
        {failures.length ? t('escrow.failures.subtitle') : t('escrow.failures.empty')}
      </p>
      {failures.length > 0 && (
        <div className="finances-table mt-3">
          <Table<PaymentFailure>
            rowKey="id"
            columns={columns}
            dataSource={failures}
            size="middle"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 'max-content' }}
          />
        </div>
      )}
      <ReasonModal
        open={closing !== null}
        title={t('escrow.failures.closeTitle')}
        confirmLabel={t('escrow.failures.closeConfirm')}
        required
        loading={resolve.isPending}
        onCancel={() => setClosing(null)}
        onConfirm={(note) => {
          if (!closing) return
          const target = closing
          resolve.mutate(
            { id: target.id, note },
            {
              onSuccess: () => {
                setClosing(null)
                void message.success(t('escrow.failures.closed', { ref: label(target) }))
              },
              onError: (err) => void message.error(apiMessage(err, t('escrow.failures.closeFailed'))),
            },
          )
        }}
      />
    </section>
  )
}

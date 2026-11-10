import { useMemo, useState } from 'react'
import { Alert, Select, Spin, Table, Tag, Tooltip, message } from 'antd'
import type { TableProps } from 'antd/es/table'
import { ArrowLeft, Plus, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppButton } from '../../atoms/AppButton'
import { HttpError } from '../../../shared/api/httpClient'
import { ReasonModal, TestBookingModal } from './components/EscrowModals'
import { useEscrowActionMutation, useEscrowQuery, useTestBookingMutation } from './hooks/useEscrow'
import type { EscrowAction, EscrowItem, EscrowStatus, EscrowSummary } from './types'

const STATUS_COLOR: Record<EscrowStatus, string> = {
  PENDING_PAYMENT: 'default',
  AUTHORIZED: 'gold',
  IN_ESCROW: 'blue',
  RELEASED: 'green',
  REFUNDED: 'magenta',
  VOIDED: 'default',
}

const formatPkr = (n: number) =>
  `PKR ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`

/** Prefers the API's human-readable `error.message` over the bare error code. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    const body = err.responseBody as { error?: { message?: string } } | null | undefined
    return body?.error?.message || fallback
  }
  return fallback
}

function SummaryCards({ summary }: { summary: EscrowSummary }) {
  const { t } = useTranslation('finances')
  const cards: { key: keyof EscrowSummary; hint: string }[] = [
    { key: 'authorized', hint: t('escrow.summaryHint.authorized') },
    { key: 'inEscrow', hint: t('escrow.summaryHint.inEscrow') },
    { key: 'released', hint: t('escrow.summaryHint.released') },
    { key: 'refunded', hint: t('escrow.summaryHint.refunded') },
    { key: 'platformFees', hint: t('escrow.summaryHint.platformFees', { pct: summary.platformFeePct }) },
  ]
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
      {cards.map(({ key, hint }) => (
        <div key={key} className="rounded-xl border border-(--color-border) bg-(--color-card) p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-(--color-text-muted)">
            {t(`escrow.summary.${key}`)}
          </div>
          <div className="text-xl font-bold text-(--color-text) mt-1 tabular-nums">
            {formatPkr(summary[key] as number)}
          </div>
          <div className="text-xs text-(--color-text-muted) mt-1">{hint}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * Escrow & payouts — every Mingler payment GoMingle holds through Safepay,
 * from card hold to release (restaurant payout) or refund.
 */
export function EscrowPage() {
  const { t } = useTranslation('finances')
  const navigate = useNavigate()
  const [status, setStatus] = useState<EscrowStatus | undefined>()
  const [pending, setPending] = useState<{ item: EscrowItem; action: 'void' | 'refund' } | null>(null)
  const [testOpen, setTestOpen] = useState(false)
  const query = useEscrowQuery(status)
  const actionMutation = useEscrowActionMutation()
  const testMutation = useTestBookingMutation()

  const run = (item: EscrowItem, action: EscrowAction, reason?: string) => {
    actionMutation.mutate(
      { id: item.id, action, reason },
      {
        onSuccess: () => {
          setPending(null)
          void message.success(t(`escrow.done.${action}`, { ref: item.bookingRef }))
        },
        onError: (err) => void message.error(errorMessage(err, t('escrow.actionFailed'))),
      },
    )
  }

  const columns = useMemo<TableProps<EscrowItem>['columns']>(
    () => [
      {
        title: t('escrow.col.booking'),
        key: 'booking',
        render: (_, r) => (
          <div>
            <div className="font-semibold">{r.bookingRef}</div>
            <div className="text-xs text-(--color-text-muted)">{r.eventName}</div>
          </div>
        ),
      },
      { title: t('escrow.col.restaurant'), dataIndex: 'restaurantName', key: 'restaurant' },
      {
        title: t('escrow.col.mingler'),
        key: 'mingler',
        render: (_, r) => `${r.minglerName} · ${t('escrow.guests', { count: r.guests })}`,
      },
      {
        title: t('escrow.col.amount'),
        key: 'amount',
        align: 'right',
        render: (_, r) => <span className="tabular-nums">{formatPkr(r.amount)}</span>,
      },
      {
        title: t('escrow.col.status'),
        key: 'status',
        render: (_, r) => (
          <Tooltip title={r.timeline.map((e) => `${e.status} · ${e.by}`).join('\n')}>
            <Tag color={STATUS_COLOR[r.status]}>{t(`escrow.status.${r.status}`)}</Tag>
          </Tooltip>
        ),
      },
      {
        title: t('escrow.col.payout'),
        key: 'payout',
        render: (_, r) =>
          r.payout ? (
            <div>
              <div className="tabular-nums">{formatPkr(r.payout.amount)}</div>
              <div className="text-xs text-(--color-text-muted)">
                {r.payout.bank} {r.payout.ibanMasked} · {r.payout.reference}
              </div>
            </div>
          ) : (
            <div className="text-xs text-(--color-text-muted)">
              {t('escrow.netAfterFee', { net: formatPkr(r.restaurantNet), fee: formatPkr(r.platformFee) })}
              <div>{r.payoutTo ?? t('escrow.noPayoutAccount')}</div>
            </div>
          ),
      },
      {
        title: t('escrow.col.actions'),
        key: 'actions',
        render: (_, r) => {
          const busy = actionMutation.isPending && actionMutation.variables?.id === r.id
          if (r.status === 'AUTHORIZED') {
            return (
              <div className="flex gap-2">
                <AppButton variant="primary" loading={busy} onClick={() => run(r, 'capture')}>
                  {t('escrow.action.capture')}
                </AppButton>
                <AppButton variant="neutral" disabled={busy} onClick={() => setPending({ item: r, action: 'void' })}>
                  {t('escrow.action.void')}
                </AppButton>
              </div>
            )
          }
          if (r.status === 'IN_ESCROW') {
            return (
              <div className="flex gap-2">
                <AppButton variant="primary" loading={busy} onClick={() => run(r, 'release')}>
                  {t('escrow.action.release')}
                </AppButton>
                <AppButton variant="neutral" disabled={busy} onClick={() => setPending({ item: r, action: 'refund' })}>
                  {t('escrow.action.refund')}
                </AppButton>
              </div>
            )
          }
          return <span className="text-xs text-(--color-text-muted)">—</span>
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, actionMutation.isPending, actionMutation.variables],
  )

  const data = query.data

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => navigate('/finances')}
        className="inline-flex items-center gap-1.5 text-sm text-(--color-accent) bg-transparent border-0 p-0 mb-3 cursor-pointer w-fit"
      >
        <ArrowLeft size={14} /> {t('escrow.back')}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="m-0 text-[26px] font-bold text-(--color-text) [font-family:var(--font-ui)] leading-tight">
          {t('escrow.title')}
        </h1>
        <AppButton variant="primary" onClick={() => setTestOpen(true)} disabled={!data}>
          <Plus size={15} /> {t('escrow.testBooking.open')}
        </AppButton>
      </div>
      {data && (
        <div className="flex items-center gap-2 text-sm text-(--color-text-muted) mb-6">
          <ShieldCheck size={16} weight="fill" className="text-(--color-accent)" />
          {t('escrow.gateway', {
            name: data.gateway.name,
            env: data.gateway.environment,
            mode: t(`escrow.mode.${data.gateway.mode}`),
          })}
        </div>
      )}

      {query.isLoading && (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      )}
      {query.isError && <Alert type="error" showIcon message={t('escrow.loadFailed')} />}

      {data && (
        <>
          <SummaryCards summary={data.summary} />
          <div className="flex items-center justify-between gap-3 mb-3">
            <Select
              allowClear
              className="w-56"
              placeholder={t('escrow.filterStatus')}
              value={status}
              onChange={(v?: EscrowStatus) => setStatus(v)}
              options={(Object.keys(STATUS_COLOR) as EscrowStatus[]).map((s) => ({
                value: s,
                label: t(`escrow.status.${s}`),
              }))}
            />
            <span className="text-sm text-(--color-text-muted)">
              {t('escrow.count', { count: data.items.length })}
            </span>
          </div>
          {/* Shares the Finances grid styling (padding, header, row hover). */}
          <div className="finances-table">
            <Table<EscrowItem>
              rowKey="id"
              columns={columns}
              dataSource={data.items}
              size="middle"
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              scroll={{ x: 'max-content' }}
              locale={{ emptyText: t('escrow.empty') }}
            />
          </div>
        </>
      )}

      <ReasonModal
        open={pending !== null}
        title={pending ? t(`escrow.confirm.${pending.action}`, { ref: pending.item.bookingRef }) : ''}
        confirmLabel={pending ? t(`escrow.action.${pending.action}`) : ''}
        required={pending?.action === 'refund'}
        loading={actionMutation.isPending}
        onCancel={() => setPending(null)}
        onConfirm={(reason) => pending && run(pending.item, pending.action, reason || undefined)}
      />
      <TestBookingModal
        open={testOpen}
        restaurants={data?.restaurants ?? []}
        loading={testMutation.isPending}
        onCancel={() => setTestOpen(false)}
        onSubmit={(body) =>
          testMutation.mutate(body, {
            onSuccess: (item) => {
              setTestOpen(false)
              void message.success(t('escrow.testBooking.done', { ref: item.bookingRef, amount: formatPkr(item.amount) }))
            },
            onError: (err) => void message.error(errorMessage(err, t('escrow.actionFailed'))),
          })
        }
      />
    </div>
  )
}

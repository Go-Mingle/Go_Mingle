import { Alert, Skeleton } from 'antd'
import { Bank, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { usePartnerEscrowQuery } from '../hooks/useFinancesLedger'
import { formatPkr } from '../financesFormat'

/**
 * The restaurant's Safepay escrow position: money held on Minglers' cards,
 * money collected and waiting for the event, and what has been paid out.
 */
export function EscrowPanel() {
  const { t } = useTranslation('finances')
  const { data, isPending, isError } = usePartnerEscrowQuery()

  if (isPending) return <Skeleton active paragraph={{ rows: 2 }} className="mb-6" />
  if (isError || !data) {
    return <Alert type="warning" showIcon className="mb-6" message={t('escrow.loadFailed')} />
  }

  const lastPayout = data.items.find((i) => i.payout)?.payout
  const tiles = [
    { label: t('escrow.heldOnCards'), value: data.summary.authorized, hint: t('escrow.heldOnCardsHint') },
    { label: t('escrow.inEscrow'), value: data.summary.inEscrow, hint: t('escrow.inEscrowHint') },
    {
      label: t('escrow.paidOut'),
      value: data.summary.released,
      hint: t('escrow.paidOutHint', { pct: data.summary.platformFeePct }),
    },
  ]

  return (
    <section
      aria-label={t('escrow.title')}
      className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-card)] p-4"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 inline-flex items-center gap-2 text-base font-semibold text-[var(--color-text)]">
          <ShieldCheck size={18} weight="fill" className="text-[var(--color-accent)]" />
          {t('escrow.title')}
        </h2>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {t('escrow.gateway', { name: data.gateway.name, env: data.gateway.environment })}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg bg-[var(--color-bg)] p-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {tile.label}
            </div>
            <div className="mt-1 text-lg font-bold tabular-nums text-[var(--color-text)]">
              {formatPkr(tile.value)}
            </div>
            <div className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{tile.hint}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-1 text-sm text-[var(--color-text-secondary)]">
        {data.payoutAccount ? (
          <span className="inline-flex items-center gap-1.5">
            <Bank size={15} />
            {t('escrow.payoutTo', {
              bank: data.payoutAccount.bankName,
              iban: data.payoutAccount.iban,
              title: data.payoutAccount.accountTitle,
            })}
          </span>
        ) : (
          <Alert type="info" showIcon message={t('escrow.noAccount')} />
        )}
        {lastPayout && (
          <span>
            {t('escrow.lastPayout', {
              reference: lastPayout.reference,
              amount: formatPkr(lastPayout.amount),
              date: new Date(lastPayout.paidAt).toLocaleDateString('en-PK'),
            })}
          </span>
        )}
      </div>
    </section>
  )
}

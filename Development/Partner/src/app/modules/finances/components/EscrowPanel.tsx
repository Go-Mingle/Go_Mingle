import { CountUp } from '../../../visual/CountUp'
import { EscrowFlow, type FlowStep } from '../../../visual/EscrowFlow'
import { Alert, Skeleton } from 'antd'
import { Bank, ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { usePartnerEscrowQuery } from '../hooks/useFinancesLedger'
import { formatPkr } from '../financesFormat'

/** DD-MM-YYYY in Pakistan time, the portal's usual date format. */
const pkDay = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))
    .replace(/\//g, '-')

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
  const amount = (value: number) => <CountUp value={value} format={formatPkr} />
  const steps: FlowStep[] = [
    {
      key: 'held',
      label: t('escrow.heldOnCards'),
      amount: amount(data.summary.authorized),
      hint: t('escrow.heldOnCardsHint'),
    },
    {
      key: 'escrow',
      label: t('escrow.inEscrow'),
      amount: amount(data.summary.inEscrow),
      hint: t('escrow.inEscrowHint'),
    },
    {
      key: 'paid',
      label: t('escrow.paidOut'),
      amount: amount(data.summary.released),
      hint: t('escrow.paidOutHint', { pct: data.summary.platformFeePct }),
      final: true,
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
      </div>
      <EscrowFlow steps={steps} />
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
              date: pkDay(lastPayout.paidAt),
            })}
          </span>
        )}
      </div>
    </section>
  )
}

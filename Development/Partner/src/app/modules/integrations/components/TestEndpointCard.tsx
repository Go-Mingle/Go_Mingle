import { useState } from 'react'
import { Select, Tooltip } from 'antd'
import { PaperPlaneTilt, Info, CircleNotch, WarningCircle } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { WebhookCard } from './WebhookCard'
import { AppButton } from '../../../atoms/AppButton'
import { WEBHOOK_STREAMS } from '../webhookMeta'
import type { WebhookEventType } from '../types'

const LABEL = 'text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

interface TestEndpointCardProps {
  canTest: boolean
  sending: boolean
  onSend: (eventType: WebhookEventType) => void
  /** A send is accepted and the log has not shown it yet (MET-1277). */
  awaiting?: boolean
  /** The wait ended with nothing in the log. */
  awaitingStale?: boolean
}

/**
 * MET-1277 — the send lives on this tab and its result lives on another one, so
 * a 202 followed by silence here reads as nothing having happened. The toast
 * points at Recent deliveries but is gone in three seconds; this line stays for
 * as long as the wait does.
 */
function AwaitingHint({ stale }: { stale: boolean }) {
  const { t } = useTranslation('integrations')
  const Icon = stale ? WarningCircle : CircleNotch

  return (
    <p
      className={`flex items-center gap-1.5 mt-2.5 mb-0 text-[12.5px] ${
        stale ? 'text-[var(--color-warning)]' : 'text-[var(--color-text-secondary)]'
      }`}
    >
      <Icon size={14} className={stale ? undefined : 'animate-spin'} />
      {t(stale ? 'test.awaitingStale' : 'test.awaiting')}
    </p>
  )
}

export function TestEndpointCard({
  canTest,
  sending,
  onSend,
  awaiting,
  awaitingStale,
}: TestEndpointCardProps) {
  const { t } = useTranslation('integrations')
  const [selected, setSelected] = useState<WebhookEventType>('BOOKING_CREATED')

  const options = WEBHOOK_STREAMS.map((stream) => ({
    label: t(stream.labelKey),
    title: t(stream.labelKey),
    options: stream.events.map((ev) => ({
      value: ev.type,
      label: `${t(stream.labelKey)} · ${t(ev.nameKey)}`,
    })),
  }))

  return (
    <WebhookCard title={t('test.title')}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className={LABEL}>{t('test.label')}</span>
        <Tooltip title={t('test.labelTooltip')}>
          <Info size={13} className="text-[var(--color-text-subtle)] cursor-help" />
        </Tooltip>
      </div>
      <div className="flex flex-col sm:flex-row gap-2.5">
        <Select
          size="large"
          value={selected}
          onChange={(v) => setSelected(v as WebhookEventType)}
          options={options}
          className="flex-1"
        />
        <AppButton
          variant="primary"
          onClick={() => onSend(selected)}
          disabled={!canTest || sending}
          className="h-10 justify-center"
        >
          <PaperPlaneTilt size={15} weight="fill" />
          {sending ? t('test.sending') : t('test.send')}
        </AppButton>
      </div>
      {awaiting && <AwaitingHint stale={!!awaitingStale} />}
    </WebhookCard>
  )
}

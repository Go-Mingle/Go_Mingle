import { ArrowsClockwise, EnvelopeSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { WebhookCard } from './WebhookCard'

/**
 * Static explainer for the automatic retry + email-fallback behaviour (AC-04.3).
 *
 * The fallback address is deliberately not named. It is `restaurants.email`,
 * resolved by F2 (BR-14), and J4 exposes no field for it — the Figma's
 * `owner@aurelia.pk` is a placeholder, so hardcoding any address here would be
 * wrong for every restaurant but one.
 */
export function DeliveryInfoCard() {
  const { t } = useTranslation('integrations')
  return (
    <WebhookCard title={t('delivery.title')}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-[12px] bg-[var(--color-page)] p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <ArrowsClockwise size={16} className="text-[var(--color-accent)]" />
            <h3 className="text-[13px] font-semibold text-[var(--color-text)] m-0">
              {t('delivery.retriesTitle')}
            </h3>
          </div>
          <p className="text-[12.5px] text-[var(--color-text-muted)] m-0 leading-[1.6]">
            {t('delivery.retriesBody')}
          </p>
        </div>
        <div className="rounded-[12px] bg-[var(--color-page)] p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <EnvelopeSimple size={16} className="text-[var(--color-accent)]" />
            <h3 className="text-[13px] font-semibold text-[var(--color-text)] m-0">
              {t('delivery.emailTitle')}
            </h3>
          </div>
          <p className="text-[12.5px] text-[var(--color-text-muted)] m-0 leading-[1.6]">
            {t('delivery.emailBody')}
          </p>
        </div>
      </div>
    </WebhookCard>
  )
}

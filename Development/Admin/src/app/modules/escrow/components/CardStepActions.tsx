import { Tooltip, message } from 'antd'
import { useTranslation } from 'react-i18next'
import { useHref, useLocation } from 'react-router-dom'
import { AppButton } from '../../../atoms/AppButton'
import { HttpError } from '../../../../shared/api/httpClient'
import { CHECKOUT_RETURN_PARAM } from '../constants'
import { useAnnounceCheckout } from '../hooks/useAnnounceCheckout'
import { useConfirmCheckoutMutation, useStartCheckoutMutation } from '../hooks/useEscrow'
import type { EscrowItem } from '../types'

function serverMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpError) {
    const body = err.responseBody as { error?: { message?: string } } | null | undefined
    return body?.error?.message || fallback
  }
  return fallback
}

interface CardStepActionsProps {
  item: EscrowItem
  /** True when real Safepay keys are set, so Safepay's checkout page can be opened. */
  live: boolean
  onAddTestCard: (item: EscrowItem) => void
}

/**
 * What an admin can do with a hold that is waiting for a card.
 *
 * TEMPORARY (GM-255): this is the Mingler app's card step. Until that app
 * exists an admin pays on Safepay's own checkout page when Safepay keys are set
 * (a real sandbox payment, visible in the Safepay dashboard), or adds a test
 * card when they are not (simulated, nothing reaches Safepay).
 */
export function CardStepActions({ item, live, onAddTestCard }: CardStepActionsProps) {
  const { t } = useTranslation('finances')
  const start = useStartCheckoutMutation()
  const confirm = useConfirmCheckoutMutation()
  const announce = useAnnounceCheckout()
  const here = useHref(useLocation().pathname)

  const pay = () => {
    // This page's own address (with the router's base path), naming the hold that is being paid for.
    const back = new URL(`${here}?${CHECKOUT_RETURN_PARAM}=${encodeURIComponent(item.id)}`, window.location.origin)
    start.mutate(
      { id: item.id, returnUrl: back.toString() },
      {
        // Safepay's page takes over this tab and sends the admin back here when done.
        onSuccess: ({ url }) => void window.open(url, '_self'),
        onError: (err) => void message.error(serverMessage(err, t('escrow.checkout.failed'))),
      },
    )
  }

  const check = () => {
    confirm.mutate(item.id, {
      onSuccess: (result) => announce(item.bookingRef, result),
      onError: (err) => void message.error(serverMessage(err, t('escrow.checkout.failed'))),
    })
  }

  return (
    <div className="flex flex-wrap gap-2">
      {live && item.checkout && !item.checkout.paidAt && (
        <AppButton variant="primary" loading={confirm.isPending} onClick={check}>
          {t('escrow.checkout.check')}
        </AppButton>
      )}
      {live && (
        <Tooltip title={t('escrow.checkout.openHint')}>
          <span>
            <AppButton variant={item.checkout ? 'neutral' : 'primary'} loading={start.isPending} onClick={pay}>
              {t('escrow.checkout.open')}
            </AppButton>
          </span>
        </Tooltip>
      )}
      {/* With Safepay connected every payment goes through Safepay, so it shows there;
          the simulated test card is only for running without Safepay keys. */}
      {!live && (
        <AppButton variant="primary" onClick={() => onAddTestCard(item)}>
          {t('escrow.testCard.open')}
        </AppButton>
      )}
    </div>
  )
}

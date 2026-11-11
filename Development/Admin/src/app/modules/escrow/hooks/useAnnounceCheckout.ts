import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import type { CheckoutConfirmation } from '../types'

/** Tells the admin what Safepay answered about a checkout. */
export function useAnnounceCheckout() {
  const { t } = useTranslation('finances')
  return (ref: string, result: CheckoutConfirmation) => {
    if (!result.paid) {
      void message.warning(t('escrow.checkout.notPaid', { state: result.state }))
    } else if (result.state === 'ALREADY_CONFIRMED') {
      void message.info(t('escrow.checkout.alreadyConfirmed'))
    } else {
      void message.success(t('escrow.checkout.confirmed', { ref: result.items[0]?.bookingRef ?? ref, count: result.items.length }))
    }
  }
}

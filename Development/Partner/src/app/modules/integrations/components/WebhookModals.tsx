import { ArrowsClockwise, PlugsConnected, Plugs } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../../molecules/ConfirmModal'
import { SecretRevealModal } from './SecretRevealModal'

interface WebhookModalsProps {
  revealedSecret: string | null
  onCloseSecret: () => void
  rotateOpen: boolean
  onRotateCancel: () => void
  onRotateConfirm: () => void
  toggleTarget: boolean | null
  onToggleCancel: () => void
  onToggleConfirm: () => void
}

export function WebhookModals({
  revealedSecret,
  onCloseSecret,
  rotateOpen,
  onRotateCancel,
  onRotateConfirm,
  toggleTarget,
  onToggleCancel,
  onToggleConfirm,
}: WebhookModalsProps) {
  const { t } = useTranslation(['integrations', 'common'])

  return (
    <>
      <SecretRevealModal secret={revealedSecret} onClose={onCloseSecret} />

      <ConfirmModal
        open={rotateOpen}
        onCancel={onRotateCancel}
        onConfirm={onRotateConfirm}
        danger
        icon={<ArrowsClockwise size={24} weight="bold" color="var(--color-error)" />}
        title={t('secret.rotateTitle')}
        content={t('secret.rotateBody')}
        confirmText={t('secret.rotateConfirm')}
        cancelText={t('common:buttons.cancel')}
      />

      {/* Turn webhooks on/off — confirmed like the profile visibility toggle. */}
      <ConfirmModal
        open={toggleTarget !== null}
        onCancel={onToggleCancel}
        onConfirm={onToggleConfirm}
        danger={toggleTarget === false}
        icon={
          toggleTarget ? (
            <PlugsConnected size={24} weight="fill" color="var(--color-accent)" />
          ) : (
            <Plugs size={24} weight="fill" color="var(--color-error)" />
          )
        }
        title={toggleTarget ? t('toggle.onTitle') : t('toggle.offTitle')}
        content={toggleTarget ? t('toggle.onContent') : t('toggle.offContent')}
        confirmText={toggleTarget ? t('toggle.onConfirm') : t('toggle.offConfirm')}
        cancelText={t('common:buttons.cancel')}
      />
    </>
  )
}

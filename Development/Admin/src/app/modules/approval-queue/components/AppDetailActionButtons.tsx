import { Grid } from 'antd'
import { useTranslation } from 'react-i18next'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { AppButton } from '../../../atoms/AppButton'

interface AppDetailActionButtonsProps {
  onApproveClick: () => void
  onDeclineClick: () => void
}

export function AppDetailActionButtons({
  onApproveClick,
  onDeclineClick,
}: AppDetailActionButtonsProps) {
  const { t } = useTranslation('approval-queue')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  return (
    <>
      <AppButton
        variant="danger"
        onClick={onDeclineClick}
        style={{ flex: isMobile ? 1 : undefined }}
      >
        <XCircle size={14} /> {t('actions.decline')}
      </AppButton>
      <AppButton
        variant="secondary"
        onClick={onApproveClick}
        style={{ flex: isMobile ? 1 : undefined }}
      >
        <CheckCircle size={14} /> {t('actions.approve')}
      </AppButton>
    </>
  )
}

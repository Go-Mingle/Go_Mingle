import { Button, Grid } from 'antd'
import { Check } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface CardFooterProps {
  onCancel: () => void
  onSave: () => void
  saveLabel: string
  disabled: boolean
  loading: boolean
}

export function CardFooter({ onCancel, onSave, saveLabel, disabled, loading }: CardFooterProps) {
  const { t } = useTranslation('loyalty')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  return (
    <div
      className={`flex gap-2 mt-6 pt-5 border-t border-(--color-divider) ${isMobile ? '' : 'justify-end'}`}
    >
      <Button onClick={onCancel} className={isMobile ? 'flex-1' : ''}>
        {t('cancel')}
      </Button>
      <Button
        type="primary"
        onClick={onSave}
        disabled={disabled}
        loading={loading}
        icon={!loading ? <Check size={14} weight="bold" /> : undefined}
        className={isMobile ? 'flex-1' : ''}
      >
        {saveLabel}
      </Button>
    </div>
  )
}

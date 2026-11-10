import { Flex } from 'antd'
import { Plus } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'

interface UsersPageHeaderProps {
  isMobile: boolean
  onNew: () => void
}

export function UsersPageHeader({ isMobile, onNew }: UsersPageHeaderProps) {
  const { t } = useTranslation('users')

  return (
    <Flex align="center" justify="space-between" gap={12} className="mb-6!">
      <h1
        className={`m-0 ${
          isMobile ? 'text-[20px]' : 'text-[26px]'
        } font-bold text-[var(--color-text)] font-[Poppins,sans-serif] leading-[1.2]`}
      >
        {t('title')}
      </h1>
      <AppButton variant="primary" onClick={onNew}>
        <Plus size={15} weight="bold" />
        {t('actions.newUserShort')}
      </AppButton>
    </Flex>
  )
}

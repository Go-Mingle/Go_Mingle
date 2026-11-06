import { Monitor } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

export function ScreenSizePrompt() {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-4 px-8 text-center">
      <div className="w-14 h-14 rounded-full bg-[var(--color-teal-light)] flex items-center justify-center">
        <Monitor size={24} className="text-[var(--color-accent)]" />
      </div>
      <div>
        <p className="text-[16px] font-semibold text-[var(--color-text)] mb-1">
          {t('screenSize.largerRequired')}
        </p>
        <p className="text-[14px] text-[var(--color-text-muted)] max-w-[280px]">
          {t('screenSize.description')}
        </p>
      </div>
    </div>
  )
}

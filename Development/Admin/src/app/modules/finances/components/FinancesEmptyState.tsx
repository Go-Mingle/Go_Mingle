import { Receipt } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface FinancesEmptyStateProps {
  /**
   * A date range (period preset or the Date column filter) is narrowing the
   * result set, so point the user at widening it rather than telling them no
   * transactions exist at all.
   */
  dateFiltered?: boolean
}

export function FinancesEmptyState({ dateFiltered = false }: FinancesEmptyStateProps) {
  const { t } = useTranslation('finances')

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-16 px-6">
      <div className="flex items-center justify-center w-18 h-18 rounded-full bg-(--color-accent-light)">
        <Receipt size={34} weight="regular" className="text-(--color-accent)" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-90">
        <span className="[font-family:var(--font-ui)] text-base font-semibold text-(--color-text)">
          {t('emptyState.title')}
        </span>
        <span className="[font-family:var(--font-ui)] text-[13px] leading-relaxed text-(--color-text-muted)">
          {t(dateFiltered ? 'emptyState.periodMessage' : 'emptyState.message')}
        </span>
      </div>
    </div>
  )
}

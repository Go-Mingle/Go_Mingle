import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'

interface FinancesNoResultsProps {
  onClearFilters: () => void
}

/**
 * Shown when active filters match no records on the mobile card list, which has
 * no column-header filter UI of its own.
 *
 * Deliberately distinct from `FinancesEmptyState`: that one means "there is
 * nothing here at all", whereas this one means "your filters excluded
 * everything" and must offer a way back — previously a filtered-to-zero result
 * replaced the whole view and left no control to clear the filter.
 */
export function FinancesNoResults({ onClearFilters }: FinancesNoResultsProps) {
  const { t } = useTranslation('finances')

  return (
    <div className="flex flex-col items-center justify-center text-center gap-4 py-12 px-6">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-(--color-page)">
        <MagnifyingGlass size={26} weight="regular" className="text-(--color-text-subtle)" />
      </div>
      <div className="flex flex-col gap-1.5 max-w-90">
        <span className="[font-family:var(--font-ui)] text-base font-semibold text-(--color-text)">
          {t('noResults.title')}
        </span>
        <span className="[font-family:var(--font-ui)] text-[13px] leading-relaxed text-(--color-text-muted)">
          {t('noResults.message')}
        </span>
      </div>
      <AppButton variant="neutral" onClick={onClearFilters}>
        {t('noResults.clearFilters')}
      </AppButton>
    </div>
  )
}

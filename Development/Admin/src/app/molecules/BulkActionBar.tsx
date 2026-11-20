import type { ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton, type AppButtonVariant } from '../atoms/AppButton'

export interface BulkAction {
  key: string
  label: string
  icon?: ReactNode
  variant?: AppButtonVariant
  onClick: () => void
}

interface Props {
  count: number
  actions: BulkAction[]
  onClear: () => void
}

/**
 * Floats at the bottom of a list once rows are selected: how many, what can be
 * done to all of them, and a way to clear the selection.
 */
export function BulkActionBar({ count, actions, onClear }: Props) {
  const { t } = useTranslation('common')
  if (count === 0) return null
  return (
    <div
      role="region"
      aria-label={t('bulk.region')}
      data-testid="bulk-bar"
      className="gm-bulk-bar fixed bottom-5 left-1/2 z-20 flex max-w-[calc(100vw-24px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-[var(--radius-md,14px)] border border-[var(--color-border)] bg-[var(--color-card)] py-2 pr-2 pl-4 shadow-[0_18px_48px_-12px_rgb(15_23_42/0.35)]"
    >
      <span className="mr-2 text-[14px] font-semibold text-[var(--color-text)]" aria-live="polite">
        {t('bulk.selected', { count })}
      </span>
      {actions.map((a) => (
        <AppButton
          key={a.key}
          variant={a.variant ?? 'neutral'}
          onClick={a.onClick}
          data-testid={`bulk-${a.key}`}
        >
          {a.icon}
          {a.label}
        </AppButton>
      ))}
      <button
        type="button"
        onClick={onClear}
        aria-label={t('bulk.clear')}
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[var(--radius-sm)] border-none bg-transparent text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-hover-neutral)] hover:text-[var(--color-text)]"
      >
        <X size={16} weight="bold" aria-hidden />
      </button>
    </div>
  )
}

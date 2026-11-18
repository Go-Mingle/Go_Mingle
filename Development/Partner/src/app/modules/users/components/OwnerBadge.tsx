import { Crown } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

/** Marks an owner: the people who can add and change the team. */
export function OwnerBadge() {
  const { t } = useTranslation('users')
  return (
    <span className="inline-flex shrink-0 items-center gap-1 h-[20px] px-1.5 rounded-full border border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-[11px] font-semibold">
      <Crown size={12} weight="fill" aria-hidden="true" />
      {t('roles.owner')}
    </span>
  )
}

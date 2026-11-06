import { Tooltip } from 'antd'
import { Warning } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface RoleNameProps {
  /** Role name as returned by the API — empty or null when the role was deleted. */
  name: string | null | undefined
}

/**
 * A-02 (pentest) — role deletion and role assignment are validated in separate
 * transactions, so an administrator can be left bound to a soft-deleted role.
 * The API then returns `role.name: ""` and the roster previously rendered an
 * empty cell, making the condition "invisible to operators" (report wording).
 *
 * That administrator cannot load the portal at all, so the roster is the only
 * place the fault can be noticed. Render it as an explicit, actionable state.
 *
 * Shared by the desktop table and the mobile card list so the two cannot drift.
 */
export function RoleName({ name }: RoleNameProps) {
  const { t } = useTranslation('users')
  const trimmed = name?.trim()

  if (trimmed) {
    return <span className="text-sm font-medium text-(--color-text-secondary)">{trimmed}</span>
  }

  return (
    <Tooltip title={t('table.roleDeletedHint')}>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-(--color-error)">
        <Warning size={14} weight="fill" aria-hidden />
        {t('table.roleDeleted')}
      </span>
    </Tooltip>
  )
}

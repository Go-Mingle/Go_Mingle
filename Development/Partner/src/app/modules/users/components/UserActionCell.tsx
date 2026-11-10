import { Tooltip } from 'antd'
import { PencilSimple, Key, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { activateOnKey } from '../../../molecules/a11y'

interface UserActionCellProps {
  onEdit: () => void
  onResetPassword: () => void
  onDelete: () => void
  /**
   * False for the primary user, who cannot be removed from here (BR-03). Edit
   * and set-password stay available on that row — only Delete is withheld.
   */
  canDelete?: boolean
}

const baseIconClass =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-[var(--color-text-muted)] transition-all duration-150 ease-out'

export function UserActionCell({
  onEdit,
  onResetPassword,
  onDelete,
  canDelete = true,
}: UserActionCellProps) {
  const { t } = useTranslation('users')

  return (
    <div className="flex items-center justify-center gap-1">
      <Tooltip title={t('tooltips.edit')} placement="top">
        <div
          role="button"
          tabIndex={0}
          aria-label={t('tooltips.edit')}
          className={`${baseIconClass} md:hover:bg-[var(--color-accent-light)] md:hover:text-[var(--color-accent)]`}
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          onKeyDown={activateOnKey(onEdit)}
        >
          <PencilSimple size={17} weight="regular" />
        </div>
      </Tooltip>

      <Tooltip title={t('tooltips.setPassword')} placement="top">
        <div
          role="button"
          tabIndex={0}
          aria-label={t('tooltips.setPassword')}
          className={`${baseIconClass} md:hover:bg-[var(--color-accent-light)] md:hover:text-[var(--color-accent)]`}
          onClick={(e) => {
            e.stopPropagation()
            onResetPassword()
          }}
          onKeyDown={activateOnKey(onResetPassword)}
        >
          <Key size={17} weight="regular" />
        </div>
      </Tooltip>

      {canDelete && (
        <Tooltip title={t('tooltips.delete')} placement="top">
          <div
            role="button"
            tabIndex={0}
            aria-label={t('tooltips.delete')}
            className={`${baseIconClass} md:hover:bg-[var(--color-error-bg)] md:hover:text-[var(--color-error)]`}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
            onKeyDown={activateOnKey(onDelete)}
          >
            <Trash size={17} weight="regular" />
          </div>
        </Tooltip>
      )}
    </div>
  )
}

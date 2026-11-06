import { Tooltip } from 'antd'
import { Key, Trash, PencilSimple } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'

interface UserActionCellProps {
  onEdit: () => void
  onResetPassword: () => void
  onDelete: () => void
}

export function UserActionCell({ onEdit, onResetPassword, onDelete }: UserActionCellProps) {
  const { t } = useTranslation('users')

  return (
    <div data-user-action="true" className="flex items-center justify-center gap-1">
      <Tooltip title={t('tooltips.edit')} placement="top">
        <div
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onEdit()
          }}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer text-(--color-text-muted) transition-all duration-150 ease-out hover:bg-(--color-accent-light) hover:text-accent"
        >
          <PencilSimple size={17} weight="regular" />
        </div>
      </Tooltip>

      <Tooltip title={t('tooltips.sendPasswordReset')} placement="top">
        <div
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onResetPassword()
          }}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer text-(--color-text-muted) transition-all duration-150 ease-out hover:bg-(--color-accent-light) hover:text-accent"
        >
          <Key size={17} weight="regular" />
        </div>
      </Tooltip>

      <Tooltip title={t('tooltips.delete')} placement="top">
        <div
          role="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer text-(--color-text-muted) transition-all duration-150 ease-out hover:bg-(--color-error-bg) hover:text-(--color-error)"
        >
          <Trash size={17} weight="regular" />
        </div>
      </Tooltip>
    </div>
  )
}

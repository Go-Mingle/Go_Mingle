import { Checks, ArrowDown, ArrowUp } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'

export type SortOrder = 'desc' | 'asc'

interface NotificationsHeaderProps {
  unreadCount: number
  onMarkAllRead: () => void
  sortOrder: SortOrder
  onSortOrderToggle: () => void
}

export function NotificationsHeader({
  unreadCount,
  onMarkAllRead,
  sortOrder,
  onSortOrderToggle,
}: NotificationsHeaderProps) {
  const { t } = useTranslation('notifications')

  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <h1 className="text-[20px] sm:text-[26px] font-bold text-[var(--color-text)] m-0 leading-tight font-[var(--font-display)]">
        {t('title')}
      </h1>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
        <AppButton variant="neutral" onClick={onSortOrderToggle} className="w-full sm:w-auto">
          {sortOrder === 'desc' ? (
            <ArrowDown size={15} weight="regular" />
          ) : (
            <ArrowUp size={15} weight="regular" />
          )}
          <span>{sortOrder === 'desc' ? t('sortNewest') : t('sortOldest')}</span>
        </AppButton>

        {unreadCount > 0 && (
          <AppButton variant="secondary" onClick={onMarkAllRead} className="w-full sm:w-auto">
            <Checks size={15} weight="regular" />
            <span>{t('markAllRead')}</span>
          </AppButton>
        )}
      </div>
    </div>
  )
}

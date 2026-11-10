import { useCallback } from 'react'
import { Alert, Grid, Pagination, Select, Spin, message } from 'antd'
import { Bell, MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../shared/utils/apiError'
import { NOTIFICATION_PAGE_SIZES } from './constants'
import { applyPickedRange, toRangeValue } from './dateRange'
import { useNotificationsPage } from './hooks/useNotificationsPage'
import type { NotificationsPageController } from './hooks/useNotificationsPage'
import { NotificationCard } from './NotificationCard'
import { NotificationsFilters } from './components/NotificationsFilters'

/**
 * The full Notifications screen (J7 US-03, US-04).
 *
 * Search, filters, sorting and paging are all server-side. The prototype did all four in
 * memory, so the row count on screen disagreed with the total.
 */
export function NotificationsPage() {
  const { t } = useTranslation('notifications')
  const [messageApi, contextHolder] = message.useMessage()

  const showError = useCallback(
    (text: string) => {
      void messageApi.error(text)
    },
    [messageApi],
  )

  const c = useNotificationsPage({ showError })

  return (
    <div>
      {contextHolder}
      <h1 className="m-0 mb-6 font-[var(--font-display)] text-xl font-bold leading-tight text-[var(--color-text)] md:text-[26px]">
        {t('title')}
      </h1>

      <NotificationsScreen c={c} />
    </div>
  )
}

/**
 * The loading / error / empty / data chain.
 *
 * The order matters. The prototype rendered its empty state whenever the list was empty,
 * *instead of* the filter bar — with a real fetch that flashes "You're all caught up" on
 * every page load, before the first response arrives. Loading is checked first for that
 * reason.
 */
function NotificationsScreen({ c }: { c: NotificationsPageController }) {
  const { t } = useTranslation('notifications')

  if (c.isPending) {
    return (
      <div className="flex justify-center py-20">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return <Alert type="error" message={getApiErrorMessage(c.error, t('loadError'))} />
  }

  // An untouched screen with nothing in it means the inbox is empty. The filter bar is
  // hidden here — there is nothing to filter — which is the one case where that is right.
  if (c.isEmpty) {
    return <NotificationsEmptyState />
  }

  return (
    <>
      <NotificationsToolbar c={c} />
      {c.noMatches ? <NoMatchesState onClear={c.clearFilters} /> : <NotificationsResults c={c} />}
    </>
  )
}

function NotificationsToolbar({ c }: { c: NotificationsPageController }) {
  return (
    <NotificationsFilters
      searchTerm={c.search}
      onSearchChange={c.applySearch}
      typeFilters={c.types}
      onTypeFiltersChange={c.applyTypes}
      typeOptions={c.typeOptions}
      status={c.status}
      onStatusChange={c.applyStatus}
      dateRange={toRangeValue(c.startDate, c.endDate)}
      // Applied, cleared, or ignored — half a range is never sent, because one date on its
      // own is a 400. The three-way decision lives in `applyPickedRange`.
      onDateRangeChange={(value) => applyPickedRange(value, c.applyDateRange)}
      sortOrder={c.sortDir}
      onSortOrderToggle={() => c.applySortDir(c.sortDir === 'desc' ? 'asc' : 'desc')}
      unreadCount={c.unreadCount}
      onMarkAllRead={c.markEverythingRead}
      markingAll={c.markingAll}
      onClearFilters={c.clearFilters}
      hasFilters={c.hasFilters}
    />
  )
}

function NotificationsResults({ c }: { c: NotificationsPageController }) {
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  return (
    <>
      <div className="notifications-list">
        {c.items.map((n) => (
          <NotificationCard
            key={n.id}
            notification={n}
            onOpen={c.openNotification}
            onMarkRead={c.markOneRead}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        <Pagination
          current={c.page}
          total={c.total}
          pageSize={c.pageSize}
          onChange={c.changePage}
          showSizeChanger={false}
          size="small"
        />
        {/* Only 10/25/50 — anything else is a 422, so the control must not offer it. */}
        {!isMobile && (
          <Select
            value={c.pageSize}
            onChange={(value) => c.changePageSize(value)}
            size="small"
            className="w-[100px]"
            options={NOTIFICATION_PAGE_SIZES.map((value) => ({
              value,
              label: `${String(value)} / page`,
            }))}
          />
        )}
      </div>
    </>
  )
}

/** BR-14 — the inbox has never had anything in it. */
function NotificationsEmptyState() {
  const { t } = useTranslation('notifications')
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent-light)]">
        <Bell size={26} className="text-[var(--color-accent)]" />
      </div>
      <h3 className="m-0 font-[var(--font-display)] text-[16px] font-bold text-[var(--color-text)]">
        {t('screenEmptyTitle')}
      </h3>
      <p className="mb-0 mt-1.5 max-w-[360px] text-[13px] text-[var(--color-text-muted)]">
        {t('screenEmptyBody')}
      </p>
    </div>
  )
}

/**
 * BR-14 — filters excluded everything, which is a different situation from an empty inbox
 * and needs a way back out. The API returns the same empty list for both.
 */
function NoMatchesState({ onClear }: { onClear: () => void }) {
  const { t } = useTranslation('notifications')
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--color-text-muted)]">
      <MagnifyingGlass size={32} className="text-[var(--color-text-subtle)]" />
      <span className="text-sm">{t('noMatch')}</span>
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-semibold text-[var(--color-accent)]"
      >
        {t('filters.clearFilters')}
      </button>
    </div>
  )
}

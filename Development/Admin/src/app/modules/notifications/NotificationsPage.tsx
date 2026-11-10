import { useState } from 'react'
import { Pagination, Grid, Spin, Alert } from 'antd'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { NotificationCard } from './NotificationCard'
import { resolveDeepLink } from './deepLink'
import { NotificationsHeader, type SortOrder } from './components/NotificationsHeader'
import {
  NotificationsFilters,
  type StatusFilter,
  type DateRangeValue,
} from './components/NotificationsFilters'
import {
  useNotificationsQuery,
  useNotificationTypesQuery,
  useUnreadCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
} from './hooks/useNotificationsQuery'
import {
  NOTIFICATIONS_DEFAULT_PAGE_SIZE,
  NOTIFICATIONS_PAGE_SIZES,
  NOTIFICATIONS_SEARCH_MAX_LENGTH,
} from './constants'
import type { ListNotificationsParams, NotificationItem } from './types'

export function NotificationsPage() {
  const { t } = useTranslation(['notifications', 'common'])
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateRange, setDateRange] = useState<DateRangeValue>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<10 | 25 | 50>(NOTIFICATIONS_DEFAULT_PAGE_SIZE)

  const startDate = dateRange?.[0]?.format('YYYY-MM-DD')
  const endDate = dateRange?.[1]?.format('YYYY-MM-DD')

  const params: ListNotificationsParams = {
    search: search.trim().slice(0, NOTIFICATIONS_SEARCH_MAX_LENGTH) || undefined,
    type: typeFilter || undefined,
    status: statusFilter,
    startDate: startDate && endDate ? startDate : undefined,
    endDate: startDate && endDate ? endDate : undefined,
    sortDir: sortOrder,
    page,
    pageSize,
  }

  const { data, isPending, isError, isFetching } = useNotificationsQuery(params)
  const { data: typesData } = useNotificationTypesQuery()
  const { data: unread } = useUnreadCountQuery()
  const markReadMutation = useMarkNotificationReadMutation()
  const markAllReadMutation = useMarkAllNotificationsReadMutation()

  const resetPage = () => setPage(1)

  const items = data?.items ?? []
  const total = data?.pagination.totalItems ?? 0

  // Distinguish a filtered-empty result from a genuinely empty inbox.
  const hasActiveFilters = Boolean(
    search.trim() || typeFilter || statusFilter !== 'all' || (startDate && endDate),
  )

  // Clicking a notification marks it read (if unread) and routes to its deepLink.
  const handleOpen = (n: NotificationItem) => {
    if (!n.readAt) markReadMutation.mutate(n.id)
    const target = resolveDeepLink(n)
    if (target) navigate(target)
  }

  return (
    <div>
      <NotificationsHeader
        unreadCount={unread?.count ?? 0}
        onMarkAllRead={() => markAllReadMutation.mutate()}
        sortOrder={sortOrder}
        onSortOrderToggle={() => {
          setSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))
          resetPage()
        }}
      />

      <NotificationsFilters
        searchTerm={search}
        onSearchChange={(v) => {
          setSearch(v)
          resetPage()
        }}
        typeFilter={typeFilter}
        typeOptions={typesData?.types ?? []}
        onTypeFilterChange={(v) => {
          setTypeFilter(v)
          resetPage()
        }}
        statusFilter={statusFilter}
        onStatusFilterChange={(v) => {
          setStatusFilter(v)
          resetPage()
        }}
        dateRange={dateRange}
        onDateRangeChange={(v) => {
          setDateRange(v)
          resetPage()
        }}
      />

      {isPending ? (
        <div className="flex justify-center py-16">
          <Spin />
        </div>
      ) : isError ? (
        <Alert type="error" showIcon message={t('common:errors.genericError')} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--color-text-muted)]">
          <MagnifyingGlass size={32} className="text-[var(--color-text-subtle)]" />
          <span className="text-sm">{hasActiveFilters ? t('noMatch') : t('empty')}</span>
          {!hasActiveFilters && (
            <span className="text-xs text-[var(--color-text-subtle)]">{t('emptyHint')}</span>
          )}
        </div>
      ) : (
        <>
          <div className={`flex flex-col gap-2 ${isFetching ? 'opacity-70' : ''}`}>
            {items.map((n) => (
              <NotificationCard
                key={n.id}
                notification={n}
                onMarkRead={(id) => markReadMutation.mutate(id)}
                onOpen={handleOpen}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-center sm:justify-end mt-5">
            <Pagination
              current={page}
              total={total}
              pageSize={pageSize}
              onChange={(p, size) => {
                setPage(p)
                if (size !== pageSize) setPageSize(size as 10 | 25 | 50)
              }}
              showSizeChanger={!isMobile}
              pageSizeOptions={[...NOTIFICATIONS_PAGE_SIZES]}
              size="small"
            />
          </div>
        </>
      )}
    </div>
  )
}

import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../shared/utils/apiError'
import {
  NOTIFICATION_DEFAULT_PAGE_SIZE,
  NOTIFICATION_DEFAULT_SORT_DIR,
  NOTIFICATION_DEFAULT_STATUS,
} from '../constants'
import { isNotificationNotFound, notificationsErrorFallbackKey } from '../errors'
import { resolveDeepLink } from '../format'
import { hasActiveFilters, isDateRangeComplete, sanitiseNotificationsParams } from '../params'
import type { NotificationItem, NotificationSortDir, NotificationStatus } from '../types'
import type { NotificationsFeedback } from './useNotificationsBell'
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationTypesQuery,
  useNotificationsQuery,
  useRefreshNotifications,
} from './usePartnerNotificationsQueries'

/**
 * The full Notifications screen (US-03, US-04).
 *
 * Search, the type/status filters, the date range, sorting and paging are all
 * **server-side**. The prototype did every one of them in memory, which meant the row
 * count on screen disagreed with the total and a partner with many notifications paged
 * through a subset.
 */
export function useNotificationsPage(feedback: NotificationsFeedback) {
  const { t } = useTranslation(['notifications', 'common'])
  const navigate = useNavigate()

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(NOTIFICATION_DEFAULT_PAGE_SIZE)
  const [search, setSearch] = useState('')
  const [types, setTypes] = useState<string[]>([])
  const [status, setStatus] = useState<NotificationStatus>(NOTIFICATION_DEFAULT_STATUS)
  const [sortDir, setSortDir] = useState<NotificationSortDir>(NOTIFICATION_DEFAULT_SORT_DIR)
  const [startDate, setStartDate] = useState<string | null>(null)
  const [endDate, setEndDate] = useState<string | null>(null)

  // Sanitised on the way out. This endpoint *rejects* a bad value rather than ignoring
  // it, so a stale filter reaching the wire would blank the screen with a 422.
  const params = useMemo(
    () =>
      sanitiseNotificationsParams({
        page,
        pageSize,
        search,
        type: types,
        status,
        sortDir,
        startDate: startDate ?? undefined,
        endDate: endDate ?? undefined,
      }),
    [page, pageSize, search, types, status, sortDir, startDate, endDate],
  )

  const listQuery = useNotificationsQuery(params)
  const typesQuery = useNotificationTypesQuery()
  const markRead = useMarkReadMutation()
  const markAllRead = useMarkAllReadMutation()
  const refresh = useRefreshNotifications()

  const showError = useCallback(
    (cause: unknown) => {
      feedback.showError(getApiErrorMessage(cause, t(notificationsErrorFallbackKey(cause))))
    },
    [feedback, t],
  )

  const handleWriteError = useCallback(
    (cause: unknown) => {
      if (isNotificationNotFound(cause)) {
        feedback.showError(t('notifications:errors.notFound'))
        refresh()
        return
      }
      showError(cause)
    },
    [feedback, refresh, showError, t],
  )

  /**
   * Any change to search, filtering or sorting returns to the first page.
   *
   * Without this, filtering while on page 4 asks for page 4 of a much shorter result set
   * and lands on an empty screen that reads as "no notifications".
   */
  const applySearch = useCallback((next: string) => {
    setSearch(next)
    setPage(1)
  }, [])

  const applyTypes = useCallback((next: string[]) => {
    setTypes(next)
    setPage(1)
  }, [])

  const applyStatus = useCallback((next: NotificationStatus) => {
    setStatus(next)
    setPage(1)
  }, [])

  const applySortDir = useCallback((next: NotificationSortDir) => {
    setSortDir(next)
    setPage(1)
  }, [])

  /**
   * The date range is applied as a pair or not at all.
   *
   * One date alone is a 400 (`ERR_DATE_RANGE_INCOMPLETE`), so the caller gates its Apply
   * button on {@link canApplyDateRange} and this setter takes both at once. Clearing
   * passes nulls.
   */
  const applyDateRange = useCallback((from: string | null, to: string | null) => {
    setStartDate(from)
    setEndDate(to)
    setPage(1)
  }, [])

  const changePageSize = useCallback((next: number) => {
    setPageSize(next)
    setPage(1)
  }, [])

  const clearFilters = useCallback(() => {
    setSearch('')
    setTypes([])
    setStatus(NOTIFICATION_DEFAULT_STATUS)
    setStartDate(null)
    setEndDate(null)
    setPage(1)
  }, [])

  /** Row body: mark read and navigate. Identical semantics to the dropdown (BR-10). */
  const openNotification = useCallback(
    (item: NotificationItem) => {
      if (!item.isRead) {
        markRead.mutate(item.id, { onError: handleWriteError })
      }

      const target = resolveDeepLink(item.deepLink)
      if (target) void navigate(target)
    },
    [markRead, handleWriteError, navigate],
  )

  /** The explicit link: mark read, stay put (AC-04.5). */
  const markOneRead = useCallback(
    (id: string) => {
      markRead.mutate(id, { onError: handleWriteError })
    },
    [markRead, handleWriteError],
  )

  const markEverythingRead = useCallback(() => {
    markAllRead.mutate(undefined, { onError: showError })
  }, [markAllRead, showError])

  const pagination = listQuery.data?.pagination
  const unreadCount = listQuery.data?.unreadCount ?? 0
  const items = listQuery.data?.items ?? []
  const filtered = hasActiveFilters(params)

  /**
   * Clamped, as the prototype's client-side pagination was: a shrinking result set — a
   * filter narrowing, or rows ageing out of the 90-day window — would otherwise strand
   * the user on a page number that no longer exists.
   */
  const currentPage = pagination ? Math.min(page, pagination.totalPages) : page

  return {
    items,
    /**
     * The restaurant's unread count, **not** the filtered total. It drives the read
     * affordances and would be wrong to read from `pagination.totalRecords`.
     */
    unreadCount,
    /** The **filtered** count, for the pager only. */
    total: pagination?.totalRecords ?? 0,

    page: currentPage,
    pageSize,
    search,
    types,
    status,
    sortDir,
    startDate,
    endDate,

    /** Options come from the catalogue, never a hardcoded list (BR-02). */
    typeOptions: typesQuery.data?.items ?? [],

    isPending: listQuery.isPending,
    isError: listQuery.isError,
    error: listQuery.error,
    isFetching: listQuery.isFetching,

    /**
     * The two full-screen empty states are different situations (BR-14), and the API
     * returns the same empty `items` for both — so they are told apart here. `isEmpty`
     * means the inbox itself is empty; `noMatches` means the filters excluded everything.
     */
    isEmpty: !listQuery.isPending && !listQuery.isError && items.length === 0 && !filtered,
    noMatches: !listQuery.isPending && !listQuery.isError && items.length === 0 && filtered,
    hasFilters: filtered,

    /** Drives every read affordance (BR-09) — removed, not disabled, when false. */
    hasUnread: unreadCount > 0,

    /** False until both ends are set, because one alone is a 400. */
    canApplyDateRange: (from: string | null, to: string | null) => isDateRangeComplete(from, to),

    changePage: setPage,
    changePageSize,
    applySearch,
    applyTypes,
    applyStatus,
    applySortDir,
    applyDateRange,
    clearFilters,

    openNotification,
    markOneRead,
    markEverythingRead,
    markingAll: markAllRead.isPending,
  }
}

export type NotificationsPageController = ReturnType<typeof useNotificationsPage>

import { useCallback, useMemo, useState } from 'react'
import { IT_DEFAULT_PAGE_SIZE } from '../constants'
import { sanitiseInterestTablesParams, statusFromFilter } from '../params'
import { useInterestTablesQuery } from './usePartnerInterestTablesQueries'
import type { InterestTableStatus } from '../types'

/**
 * The Interest Tables grid (US-01).
 *
 * Read-only: there is no create, edit, or cancel affordance anywhere on this
 * surface (BR-02). Paging and the status filter are **server-side** — the
 * prototype filtered and sliced in memory, which meant the row count on screen
 * disagreed with the total and a partner with many tables paged through a subset.
 */
export function useInterestTablesTab() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<number>(IT_DEFAULT_PAGE_SIZE)
  const [status, setStatus] = useState<InterestTableStatus | undefined>(undefined)

  // Sanitised on the way out, so a value that drifted out of range never reaches
  // the query string.
  const params = useMemo(
    () => sanitiseInterestTablesParams({ page, pageSize, status }),
    [page, pageSize, status],
  )

  const query = useInterestTablesQuery(params)

  /**
   * Any change to the filter resets to the first page.
   *
   * Without this, filtering while on page 4 asks for page 4 of a much shorter
   * result set and lands on an empty table that looks like "no interest tables".
   */
  const applyStatus = useCallback((next: unknown) => {
    setStatus(statusFromFilter(next))
    setPage(1)
  }, [])

  const changePageSize = useCallback((next: number) => {
    setPageSize(next)
    setPage(1)
  }, [])

  return {
    items: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    page,
    pageSize,
    status,

    isPending: query.isPending,
    isError: query.isError,
    error: query.error,
    /** True while a page or filter change is in flight over previous results. */
    isFetching: query.isFetching,

    changePage: setPage,
    changePageSize,
    applyStatus,
  }
}

export type InterestTablesTabController = ReturnType<typeof useInterestTablesTab>

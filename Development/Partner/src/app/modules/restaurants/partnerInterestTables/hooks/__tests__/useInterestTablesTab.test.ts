import { describe, it, expect, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { server } from '../../../../../../mocks/server'
import { HttpError } from '../../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { resetMockProfile } from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  clearMockInterestTables,
  resetMockInterestTables,
} from '../../../../../../mocks/data/partnerInterestTables'
import { PARTNER_IT_ENDPOINTS } from '../../constants'
import { useInterestTablesTab } from '../useInterestTablesTab'

function renderTab() {
  const queryClient = makeQueryClient()
  return renderHook(() => useInterestTablesTab(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

async function renderLoaded() {
  const view = renderTab()
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

/** Records the query string of every grid read, to prove paging is server-side. */
function trackQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === PARTNER_IT_ENDPOINTS.interestTables) seen.push(url.search)
  })
  return () => seen
}

beforeEach(() => {
  resetMockProfile()
  resetMockInterestTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useInterestTablesTab — loading', () => {
  it('starts pending and settles with rows and a total', async () => {
    const { result } = renderTab()
    expect(result.current.isPending).toBe(true)
    expect(result.current.items).toEqual([])

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.items.length).toBeGreaterThan(0)
    expect(result.current.total).toBeGreaterThan(0)
  })

  it('defaults to the first page at the default size', async () => {
    const { result } = await renderLoaded()

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(10)
    expect(result.current.status).toBeUndefined()
  })

  it('never includes a Draft table', async () => {
    const { result } = await renderLoaded()

    expect(result.current.items.some((item) => item.interestTableId === 'it-draft')).toBe(false)
  })

  it('handles an empty grid', async () => {
    clearMockInterestTables()
    const { result } = await renderLoaded()

    expect(result.current.items).toEqual([])
    expect(result.current.total).toBe(0)
  })

  it('reports a load failure to the caller', async () => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.interestTables, () => HttpResponse.json({}, { status: 500 })),
    )
    const { result } = renderTab()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('useInterestTablesTab — server-side paging', () => {
  it('sends the page to the server rather than slicing locally', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(2)
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('page=2'))).toBe(true)
    })
  })

  it('sends the page size and returns to page 1', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(3)
    })
    act(() => {
      result.current.changePageSize(25)
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('pageSize=25'))).toBe(true)
    })
    // A larger page size makes page 3 a different slice, so staying there could land
    // on an empty table.
    expect(result.current.page).toBe(1)
  })

  it('ignores a page size the endpoint does not offer', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePageSize(15)
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })
    expect(queries().some((query) => query.includes('pageSize=15'))).toBe(false)
  })
})

describe('useInterestTablesTab — the status filter', () => {
  it('sends the status to the server', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyStatus(['CONFIRMED'])
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('status=CONFIRMED'))).toBe(true)
    })
    expect(result.current.status).toBe('CONFIRMED')
  })

  it('resets to page 1 when the filter changes', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(2)
    })
    expect(result.current.page).toBe(2)

    act(() => {
      result.current.applyStatus(['COMPLETED'])
    })

    // Filtering while on a later page would ask for a page the filtered set may not
    // have, showing an empty table that reads as "no interest tables".
    expect(result.current.page).toBe(1)
  })

  it('clears the filter when the control is emptied', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyStatus(['CONFIRMED'])
    })
    act(() => {
      result.current.applyStatus(null)
    })

    expect(result.current.status).toBeUndefined()
  })

  it('refuses DRAFT, which is not a partner-visible status', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyStatus(['DRAFT'])
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })
    expect(result.current.status).toBeUndefined()
    expect(queries().some((query) => query.includes('status=DRAFT'))).toBe(false)
  })

  it('narrows a multi-select payload to one status', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyStatus(['COMPLETED', 'CANCELLED'])
    })

    expect(result.current.status).toBe('COMPLETED')
  })

  it('filters the returned rows', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyStatus(['CONFIRMED'])
    })

    await waitFor(() => {
      expect(result.current.items.every((item) => item.status === 'CONFIRMED')).toBe(true)
    })
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import {
  clearMockNotifications,
  markAllMockRead,
  resetMockNotifications,
} from '../../../../../mocks/data/partnerNotifications'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { NOTIFICATION_ENDPOINTS } from '../../constants'
import { useNotificationsPage } from '../useNotificationsPage'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function makeFeedback() {
  return { showError: vi.fn() }
}

function renderPage(feedback = makeFeedback()) {
  const queryClient = makeQueryClient()
  return {
    feedback,
    ...renderHook(() => useNotificationsPage(feedback), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    }),
  }
}

async function renderLoaded(feedback = makeFeedback()) {
  const view = renderPage(feedback)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

/** Records the query string of every list read, to prove the work is server-side. */
function trackQueries() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname === NOTIFICATION_ENDPOINTS.list) seen.push(url.search)
  })
  return () => seen
}

beforeEach(() => {
  resetMockNotifications()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})

afterEach(() => {
  navigate.mockClear()
  server.events.removeAllListeners()
  vi.restoreAllMocks()
})

describe('useNotificationsPage — states', () => {
  it('starts pending, then loads', async () => {
    const { result } = renderPage()
    expect(result.current.isPending).toBe(true)

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
    expect(result.current.items).toHaveLength(8)
  })

  it('defaults to page 1, 25 per page, newest first', async () => {
    const { result } = await renderLoaded()

    expect(result.current.page).toBe(1)
    expect(result.current.pageSize).toBe(25)
    expect(result.current.sortDir).toBe('desc')
    expect(result.current.status).toBe('ALL')
  })

  it('loads the type catalogue for the filter', async () => {
    const { result } = await renderLoaded()

    await waitFor(() => {
      expect(result.current.typeOptions).toHaveLength(5)
    })
  })

  it('surfaces a load failure without toasting it', async () => {
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.list}`, () => HttpResponse.json({}, { status: 500 })),
    )
    const { result, feedback } = renderPage()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
    // A failed read is an inline Alert, not a toast (the house convention).
    expect(feedback.showError).not.toHaveBeenCalled()
    // A failure is not an empty inbox.
    expect(result.current.isEmpty).toBe(false)
  })
})

describe('useNotificationsPage — the two empty states', () => {
  /**
   * The API returns the same empty `items` whether the inbox is empty or the filters
   * excluded everything, so the controller has to tell them apart (BR-14).
   */
  it('reports an empty inbox', async () => {
    clearMockNotifications()
    const { result } = await renderLoaded()

    expect(result.current.isEmpty).toBe(true)
    expect(result.current.noMatches).toBe(false)
    expect(result.current.hasFilters).toBe(false)
  })

  it('reports filters matching nothing as a different state', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applySearch('zzzz')
    })

    await waitFor(() => {
      expect(result.current.items).toEqual([])
    })
    expect(result.current.noMatches).toBe(true)
    expect(result.current.isEmpty).toBe(false)
    expect(result.current.hasFilters).toBe(true)
  })

  it('neither is true while loading', () => {
    const { result } = renderPage()

    expect(result.current.isEmpty).toBe(false)
    expect(result.current.noMatches).toBe(false)
  })

  it('clears every filter at once', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applySearch('zzzz')
    })
    act(() => {
      result.current.applyStatus('READ')
    })
    act(() => {
      result.current.applyTypes(['IT_CREATED'])
    })
    act(() => {
      result.current.clearFilters()
    })

    expect(result.current.search).toBe('')
    expect(result.current.types).toEqual([])
    expect(result.current.status).toBe('ALL')
    expect(result.current.hasFilters).toBe(false)
  })
})

describe('useNotificationsPage — the badge is not the filtered total', () => {
  /** The count describes the restaurant, not the page. */
  it('keeps the unread count while a READ filter shows only read rows', async () => {
    const { result } = await renderLoaded()
    expect(result.current.unreadCount).toBe(6)

    act(() => {
      result.current.applyStatus('READ')
    })

    await waitFor(() => {
      expect(result.current.total).toBe(2)
    })
    expect(result.current.unreadCount).toBe(6)
    expect(result.current.hasUnread).toBe(true)
  })

  it('keeps it beside a filter that matches nothing', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applySearch('zzzz')
    })

    await waitFor(() => {
      expect(result.current.total).toBe(0)
    })
    expect(result.current.unreadCount).toBe(6)
  })

  it('drops the affordances once everything is read', async () => {
    markAllMockRead()
    const { result } = await renderLoaded()

    expect(result.current.unreadCount).toBe(0)
    expect(result.current.hasUnread).toBe(false)
  })
})

describe('useNotificationsPage — server-side work', () => {
  it('sends the search term', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applySearch('Promingler')
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('search=Promingler'))).toBe(true)
    })
  })

  it('sends the type filter as repeated keys', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyTypes(['IT_CREATED', 'IT_CANCELLED'])
    })

    await waitFor(() => {
      const match = queries().find((query) => query.includes('type='))
      expect(new URLSearchParams(match).getAll('type')).toEqual(['IT_CREATED', 'IT_CANCELLED'])
    })
  })

  it('sends the status and the sort direction', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyStatus('UNREAD')
    })
    act(() => {
      result.current.applySortDir('asc')
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('status=UNREAD'))).toBe(true)
      expect(queries().some((query) => query.includes('sortDir=asc'))).toBe(true)
    })
  })

  it('sends the page and the page size', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(2)
    })
    act(() => {
      result.current.changePageSize(10)
    })

    await waitFor(() => {
      expect(queries().some((query) => query.includes('pageSize=10'))).toBe(true)
    })
    // A larger page is a different slice, so staying on page 2 could land on nothing.
    expect(result.current.page).toBe(1)
  })

  it('never sends a page size the endpoint refuses', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePageSize(100)
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })
    expect(queries().some((query) => query.includes('pageSize=100'))).toBe(false)
  })

  it.each([
    ['a search', (c: { applySearch: (v: string) => void }) => c.applySearch('mixer')],
    ['a type filter', (c: { applyTypes: (v: string[]) => void }) => c.applyTypes(['IT_CREATED'])],
    ['a status change', (c: { applyStatus: (v: 'READ') => void }) => c.applyStatus('READ')],
    ['a sort change', (c: { applySortDir: (v: 'asc') => void }) => c.applySortDir('asc')],
  ])('returns to page 1 after %s', async (_label, apply) => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(2)
    })
    act(() => {
      apply(result.current as never)
    })

    expect(result.current.page).toBe(1)
  })

  /**
   * A shrinking result set — a filter narrowing, or rows ageing out of the 90-day window
   * — would otherwise strand the user on a page that no longer exists.
   */
  it('clamps the page to what the server reports', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.changePage(9)
    })

    await waitFor(() => {
      expect(result.current.page).toBe(1)
    })
  })
})

describe('useNotificationsPage — the date range', () => {
  /** One date alone is a 400, so the caller's Apply is gated on this. */
  it('reports a half-set range as not applicable', async () => {
    const { result } = await renderLoaded()

    expect(result.current.canApplyDateRange('2026-05-01', null)).toBe(false)
    expect(result.current.canApplyDateRange(null, '2026-05-08')).toBe(false)
    expect(result.current.canApplyDateRange(null, null)).toBe(false)
    expect(result.current.canApplyDateRange('2026-05-01', '2026-05-08')).toBe(true)
  })

  it('sends both dates together', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyDateRange('2026-01-01', '2026-01-31')
    })

    await waitFor(() => {
      const match = queries().find((query) => query.includes('startDate'))
      expect(match).toContain('startDate=2026-01-01')
      expect(match).toContain('endDate=2026-01-31')
    })
  })

  /** Half a range never reaches the wire, so the 400 stays unreachable. */
  it('sends nothing for a half-set range', async () => {
    const queries = trackQueries()
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyDateRange('2026-01-01', null)
    })

    await waitFor(() => {
      expect(result.current.isFetching).toBe(false)
    })
    expect(queries().some((query) => query.includes('startDate'))).toBe(false)
  })

  it('clears the range', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.applyDateRange('2026-01-01', '2026-01-31')
    })
    act(() => {
      result.current.applyDateRange(null, null)
    })

    expect(result.current.startDate).toBeNull()
    expect(result.current.hasFilters).toBe(false)
  })

  /**
   * The picker prevents an inverted range, so this is unreachable in normal use — but the
   * code is mapped anyway, and a failed read still surfaces as an inline error rather than
   * silently showing the previous page as though it were the filtered result.
   */
  it('surfaces the range rejection rather than showing stale rows as the result', async () => {
    const { result } = await renderLoaded()

    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.list}`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_DATE_RANGE_INVALID',
              message: 'Please provide a valid date range.',
            },
          },
          { status: 400 },
        ),
      ),
    )

    act(() => {
      result.current.applyDateRange('2026-05-08', '2026-05-01')
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).code).toBe('ERR_DATE_RANGE_INVALID')
  })
})

describe('useNotificationsPage — read actions', () => {
  it('marks one read without navigating', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.markOneRead('n-1')
    })

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5)
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('marks read and navigates on a row click', async () => {
    const { result } = await renderLoaded()
    const row = result.current.items.find((item) => item.id === 'n-1')

    act(() => {
      result.current.openNotification(row!)
    })

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1')
  })

  it('marks everything read', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.markEverythingRead()
    })

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0)
    })
    expect(result.current.hasUnread).toBe(false)
  })

  it('toasts when a write fails', async () => {
    server.use(
      http.patch(`*${NOTIFICATION_ENDPOINTS.markAllRead}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    const { result, feedback } = await renderLoaded()

    act(() => {
      result.current.markEverythingRead()
    })

    await waitFor(() => {
      expect(feedback.showError).toHaveBeenCalledTimes(1)
    })
  })

  /** BR-04 — read is irreversible, so nothing here may offer the reverse. */
  it('exposes no way to mark something unread', async () => {
    const { result } = await renderLoaded()

    expect(Object.keys(result.current).filter((key) => /unread/i.test(key))).toEqual([
      'unreadCount',
      'hasUnread',
    ])
  })
})

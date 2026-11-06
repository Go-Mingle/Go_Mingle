import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import { resetMockNotifications } from '../../../../../mocks/data/partnerNotifications'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import {
  NOTIFICATION_ENDPOINTS,
  NOTIFICATION_LIST_QUERY_KEY,
  NOTIFICATION_POLL_MS,
  NOTIFICATION_UNREAD_QUERY_KEY,
} from '../../constants'
import {
  useMarkAllReadMutation,
  useMarkReadMutation,
  useNotificationTypesQuery,
  useNotificationsQuery,
  useRecentNotificationsQuery,
  useUnreadCountQuery,
} from '../usePartnerNotificationsQueries'
import type { UnreadCount } from '../../types'

function wrapperFor(queryClient = makeQueryClient()) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  }
}

function setHidden(hidden: boolean) {
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(hidden)
  // React Query's focus manager reads `visibilityState`, not `hidden`, so both have to
  // move together for a visibility test to mean anything.
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(hidden ? 'hidden' : 'visible')
}

/** Fires the event both `usePageVisible` (document) and the focus manager (window) hear. */
function fireVisibilityChange() {
  act(() => {
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  })
}

/** Counts reads of the bell endpoint, to prove the poll is gated. */
function trackCountReads() {
  let reads = 0
  server.use(
    http.get(`*${NOTIFICATION_ENDPOINTS.unreadCount}`, () => {
      reads += 1
      return HttpResponse.json({ success: true, data: { unreadCount: 6 } })
    }),
  )
  return () => reads
}

beforeEach(() => {
  resetMockNotifications()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useUnreadCountQuery', () => {
  it('loads the shared count', async () => {
    setHidden(false)
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useUnreadCountQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.data?.unreadCount).toBe(6)
    })
  })

  it('does not fire without a session', () => {
    tokenStore.clear()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useUnreadCountQuery(), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  /**
   * The gate that keeps this endpoint from being hammered: it is polled by every open tab
   * of every user of the restaurant, so a hidden tab must stop entirely.
   */
  it('does not schedule a poll while the tab is hidden', async () => {
    setHidden(true)
    const reads = trackCountReads()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useUnreadCountQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    // The initial read still happens — only the interval is suppressed.
    expect(result.current.data?.unreadCount).toBe(6)
    expect(reads()).toBe(1)
    expect(typeof result.current.refetch).toBe('function')
  })

  /**
   * MET-1262 / TC-PARTNER-NOTIF-004. The badge must adopt a number that changed on the
   * server while the partner was sitting on the screen — no reload, no interaction. The
   * interval is asserted through the constant rather than a literal so shortening or
   * lengthening the cadence cannot quietly leave this passing against the old figure.
   */
  it('adopts a count that changed server-side, on the poll alone', async () => {
    setHidden(false)
    let served = 4
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.unreadCount}`, () =>
        HttpResponse.json({ success: true, data: { unreadCount: served } }),
      ),
    )

    // `shouldAdvanceTime` keeps MSW's own async work moving while the clock is faked.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      const { wrapper } = wrapperFor()
      const { result } = renderHook(() => useUnreadCountQuery(), { wrapper })

      await waitFor(() => {
        expect(result.current.data?.unreadCount).toBe(4)
      })

      // A booking is cancelled while the partner is still looking at the portal.
      served = 6

      await act(async () => {
        await vi.advanceTimersByTimeAsync(NOTIFICATION_POLL_MS)
      })

      await waitFor(() => {
        expect(result.current.data?.unreadCount).toBe(6)
      })
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * The other half of MET-1262. A hidden tab's interval is switched off entirely, so
   * without a refetch on return the partner would face a frozen number for a further
   * poll interval after coming back — the exact staleness the gate was meant to avoid.
   */
  it('re-reads on return to a tab whose poll was gated off', async () => {
    setHidden(true)
    const reads = trackCountReads()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useUnreadCountQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(reads()).toBe(1)

    setHidden(false)
    fireVisibilityChange()

    await waitFor(() => {
      expect(reads()).toBe(2)
    })
  })

  it('surfaces a failure to the caller', async () => {
    setHidden(false)
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.unreadCount}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useUnreadCountQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('useRecentNotificationsQuery', () => {
  /** The panel's contents cost nothing until the panel is opened. */
  it('does not fetch while the panel is closed', () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useRecentNotificationsQuery(false), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches the seven newest once opened', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useRecentNotificationsQuery(true), { wrapper })

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(7)
    })
    expect(result.current.data?.unreadCount).toBe(6)
  })

  it('does not fetch without a session even when open', () => {
    tokenStore.clear()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useRecentNotificationsQuery(true), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useNotificationsQuery', () => {
  it('loads the page with its nested pagination', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useNotificationsQuery({}), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.pagination.totalRecords).toBe(8)
  })

  it('keys the cache by params so paging does not clobber the previous page', async () => {
    const { queryClient, wrapper } = wrapperFor()
    const { result } = renderHook(() => useNotificationsQuery({ page: 2 }), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(queryClient.getQueryData([...NOTIFICATION_LIST_QUERY_KEY, { page: 2 }])).toBeDefined()
    expect(queryClient.getQueryData([...NOTIFICATION_LIST_QUERY_KEY, { page: 1 }])).toBeUndefined()
  })
})

describe('useNotificationTypesQuery', () => {
  it('loads the catalogue', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useNotificationTypesQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(5)
    })
  })

  /** Static and cacheable — fetched once per session, not per filter render. */
  it('is never stale, so a re-render does not refetch it', async () => {
    let reads = 0
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.types}`, () => {
        reads += 1
        return HttpResponse.json({ success: true, data: { items: [] } })
      }),
    )
    const { wrapper } = wrapperFor()
    const first = renderHook(() => useNotificationTypesQuery(), { wrapper })
    await waitFor(() => {
      expect(first.result.current.isSuccess).toBe(true)
    })

    // A second consumer in the same session reuses the cached catalogue.
    const second = renderHook(() => useNotificationTypesQuery(), { wrapper })
    await waitFor(() => {
      expect(second.result.current.isSuccess).toBe(true)
    })

    expect(reads).toBe(1)
  })
})

describe('useMarkReadMutation', () => {
  it('adopts the count the server returns rather than its own arithmetic', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount: 6 })

    const { result } = renderHook(() => useMarkReadMutation(), { wrapper })
    result.current.mutate('n-1')

    await waitFor(() => {
      expect(queryClient.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)).toEqual({
        unreadCount: 5,
      })
    })
  })

  /**
   * The optimistic step: the badge must move before the request settles, or clicking a
   * notification feels unresponsive.
   */
  it('decrements the badge immediately, before the request resolves', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount: 6 })

    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.patch(`*${NOTIFICATION_ENDPOINTS.markRead(':id')}`, async () => {
        await held
        return HttpResponse.json({
          success: true,
          data: { id: 'n-1', isRead: true, unreadCount: 5 },
        })
      }),
    )

    const { result } = renderHook(() => useMarkReadMutation(), { wrapper })
    result.current.mutate('n-1')

    await waitFor(() => {
      expect(queryClient.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)).toEqual({
        unreadCount: 5,
      })
    })
    release()
  })

  it('never decrements below zero', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount: 0 })

    const { result } = renderHook(() => useMarkReadMutation(), { wrapper })
    result.current.mutate('n-7')

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(
      queryClient.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)?.unreadCount,
    ).toBeGreaterThanOrEqual(0)
  })

  /** Leaving an optimistic decrement in place after a refused write would misreport. */
  it('rolls the badge back when the write fails', async () => {
    server.use(
      http.patch(`*${NOTIFICATION_ENDPOINTS.markRead(':id')}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount: 6 })

    const { result } = renderHook(() => useMarkReadMutation(), { wrapper })
    result.current.mutate('n-1')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(queryClient.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)).toEqual({
      unreadCount: 6,
    })
  })

  /**
   * The rollback's other arm: a failure before the badge was ever read. There is nothing
   * to restore, so the guard must leave the key untouched rather than writing `undefined`
   * over it — which would put the bell into a loading state on a failed click.
   */
  it('leaves the badge alone when a write fails with no count cached', async () => {
    server.use(
      http.patch(`*${NOTIFICATION_ENDPOINTS.markRead(':id')}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    const { queryClient, wrapper } = wrapperFor()

    const { result } = renderHook(() => useMarkReadMutation(), { wrapper })
    result.current.mutate('n-1')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(queryClient.getQueryState(NOTIFICATION_UNREAD_QUERY_KEY)).toBeUndefined()
  })

  it('surfaces a 404 for a row the server no longer has', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useMarkReadMutation(), { wrapper })
    result.current.mutate('n-nope')

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(404)
  })
})

describe('useMarkAllReadMutation', () => {
  it('clears the badge and adopts the server count', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount: 6 })

    const { result } = renderHook(() => useMarkAllReadMutation(), { wrapper })
    result.current.mutate()

    await waitFor(() => {
      expect(queryClient.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)).toEqual({
        unreadCount: 0,
      })
    })
  })

  it('rolls back when the write fails', async () => {
    server.use(
      http.patch(`*${NOTIFICATION_ENDPOINTS.markAllRead}`, () =>
        HttpResponse.json({}, { status: 500 }),
      ),
    )
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount: 6 })

    const { result } = renderHook(() => useMarkAllReadMutation(), { wrapper })
    result.current.mutate()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(queryClient.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)).toEqual({
      unreadCount: 6,
    })
  })

  /** Idempotent — a second press reports nothing to do rather than failing. */
  it('reports zero marked when nothing is unread', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useMarkAllReadMutation(), { wrapper })

    result.current.mutate()
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    const second = renderHook(() => useMarkAllReadMutation(), { wrapper })
    second.result.current.mutate()
    await waitFor(() => {
      expect(second.result.current.data?.markedCount).toBe(0)
    })
  })
})

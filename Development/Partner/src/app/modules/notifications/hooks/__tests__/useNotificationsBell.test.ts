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
  setMockUnreadCount,
} from '../../../../../mocks/data/partnerNotifications'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { NOTIFICATION_ENDPOINTS } from '../../constants'
import { useNotificationsBell } from '../useNotificationsBell'
import type { NotificationItem } from '../../types'

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function makeFeedback() {
  return { showError: vi.fn() }
}

function renderBell(open = true, feedback = makeFeedback()) {
  const queryClient = makeQueryClient()
  return {
    feedback,
    ...renderHook(() => useNotificationsBell(open, feedback), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    }),
  }
}

async function renderLoaded(open = true, feedback = makeFeedback()) {
  const view = renderBell(open, feedback)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

function itemFrom(items: NotificationItem[], id: string): NotificationItem {
  const found = items.find((item) => item.id === id)
  if (!found) throw new Error(`fixture ${id} missing`)
  return found
}

beforeEach(() => {
  resetMockNotifications()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
})

afterEach(() => {
  navigate.mockClear()
  vi.restoreAllMocks()
})

describe('useNotificationsBell — the badge', () => {
  it('reports the shared unread count', async () => {
    const { result } = await renderLoaded()

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(6)
    })
    expect(result.current.badgeLabel).toBe('6')
    expect(result.current.hasUnread).toBe(true)
  })

  /** Removed, not zeroed — the bell shows as an outline (BR-06). */
  it('has no badge label when everything is read', async () => {
    markAllMockRead()
    const { result } = await renderLoaded()

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0)
    })
    expect(result.current.badgeLabel).toBeNull()
    expect(result.current.hasUnread).toBe(false)
  })

  it('caps the label at 99+ while keeping the true count', async () => {
    setMockUnreadCount(420)
    const { result } = await renderLoaded()

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(420)
    })
    expect(result.current.badgeLabel).toBe('99+')
  })
})

describe('useNotificationsBell — the panel', () => {
  it('fetches nothing while closed', () => {
    const { result } = renderBell(false)

    expect(result.current.items).toEqual([])
  })

  it('loads the seven newest once open', async () => {
    const { result } = await renderLoaded()
    expect(result.current.items).toHaveLength(7)
  })

  it('surfaces a panel failure to the caller rather than toasting it', async () => {
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.recent}`, () => HttpResponse.json({}, { status: 500 })),
    )
    const { result, feedback } = renderBell(true)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    // A failed read is an inline state, not a toast (the house convention).
    expect(feedback.showError).not.toHaveBeenCalled()
  })

  /**
   * The panel's response carries the authoritative count, so opening it refreshes the
   * badge rather than waiting up to 60 seconds for the next poll.
   */
  it('adopts the count the panel returns', async () => {
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.unreadCount}`, () =>
        HttpResponse.json({ success: true, data: { unreadCount: 99 } }),
      ),
      http.get(`*${NOTIFICATION_ENDPOINTS.recent}`, () =>
        HttpResponse.json({ success: true, data: { unreadCount: 3, items: [] } }),
      ),
    )
    const { result } = await renderLoaded()

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3)
    })
  })

  it('reports an empty inbox as no items', async () => {
    clearMockNotifications()
    const { result } = await renderLoaded()

    expect(result.current.items).toEqual([])
    expect(result.current.hasUnread).toBe(false)
  })
})

describe('useNotificationsBell — clicking a row', () => {
  /** Body click: mark read **and** navigate (AC-04.1). */
  it('marks read and navigates to the resolved path', async () => {
    const { result } = await renderLoaded()
    const row = itemFrom(result.current.items, 'n-1')

    act(() => {
      result.current.openNotification(row)
    })

    // The stored path is /restaurant-profile/... — the resolver strips the prefix.
    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1')
    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5)
    })
  })

  it('preserves the bookings tab on the query string', async () => {
    const { result } = await renderLoaded()
    const row = itemFrom(result.current.items, 'n-3')

    act(() => {
      result.current.openNotification(row)
    })

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1?tab=bookings')
  })

  /** AC-04.4 — a row with no destination marks read and stays put. */
  it('marks read without navigating when there is no deep link', async () => {
    markAllMockRead()
    const { result } = await renderLoaded()
    const row = itemFrom(result.current.items, 'n-7')

    act(() => {
      result.current.openNotification(row)
    })

    expect(navigate).not.toHaveBeenCalled()
  })

  /**
   * An already-read row must not spend a request re-marking it. The endpoint is
   * idempotent, so it would be harmless — just pointless traffic on every click.
   */
  it('does not re-mark a row that is already read', async () => {
    // n-1 has a deep link and is unread in the seed; marking everything read first gives
    // a read row that is still inside the panel's newest seven.
    markAllMockRead()
    let writes = 0
    server.use(
      http.patch(`*${NOTIFICATION_ENDPOINTS.markRead(':id')}`, () => {
        writes += 1
        return HttpResponse.json({
          success: true,
          data: { id: 'n-1', isRead: true, unreadCount: 0 },
        })
      }),
    )
    const { result } = await renderLoaded()
    const row = itemFrom(result.current.items, 'n-1')

    expect(row.isRead).toBe(true)
    act(() => {
      result.current.openNotification(row)
    })

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1')
    expect(writes).toBe(0)
  })

  /** An unrecognised type is legal and must still be clickable (BR-02). */
  it('navigates for a row whose type is not in the catalogue', async () => {
    const { result } = await renderLoaded()
    const row = itemFrom(result.current.items, 'n-6')

    expect(row.type).toBe('SOMETHING_NEW')
    act(() => {
      result.current.openNotification(row)
    })

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-2')
  })
})

describe('useNotificationsBell — the explicit link', () => {
  /** AC-04.5 — marks read and stays put. */
  it('marks read without navigating', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.markOneRead('n-1')
    })

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(5)
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it('clears everything and removes the affordances', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.markEverythingRead()
    })

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(0)
    })
    expect(result.current.hasUnread).toBe(false)
    expect(result.current.badgeLabel).toBeNull()
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

  /**
   * A row the server no longer has: the partner is told once and the list is re-read, so
   * the stale row disappears rather than failing on every click.
   */
  it('reports a vanished row and refreshes', async () => {
    const { result, feedback } = await renderLoaded()

    act(() => {
      result.current.markOneRead('n-nope')
    })

    await waitFor(() => {
      expect(feedback.showError).toHaveBeenCalledTimes(1)
    })
  })
})

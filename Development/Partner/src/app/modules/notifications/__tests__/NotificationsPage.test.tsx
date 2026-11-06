import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import {
  clearMockNotifications,
  markAllMockRead,
  resetMockNotifications,
} from '../../../../mocks/data/partnerNotifications'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { NOTIFICATION_ENDPOINTS } from '../constants'
import { NotificationsPage } from '../NotificationsPage'

/**
 * Driven through MSW: J7 moved the screen onto the API, so the old
 * `makeStore({ notifications: … })` preloads no longer feed it.
 */

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function setViewport(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: !isMobile && /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
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

/** Anchored on a unique body — two fixtures share the "Interest table cancelled" title. */
async function renderLoaded() {
  const view = renderWithProviders(<NotificationsPage />)
  await screen.findByText(/Your interest table Startup Mixer/)
  return view
}

beforeEach(() => {
  resetMockNotifications()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false)
  setViewport(false)
})

afterEach(() => {
  navigate.mockClear()
  server.events.removeAllListeners()
  vi.restoreAllMocks()
})

describe('NotificationsPage — states', () => {
  it('renders the title and the rows from the API', async () => {
    await renderLoaded()

    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('Promingler updated')).toBeInTheDocument()
    // Both IT_CANCELLED fixtures render, sharing one frozen title.
    expect(screen.getAllByText('Interest table cancelled')).toHaveLength(2)
  })

  it('spins while the first page loads', () => {
    const { container } = renderWithProviders(<NotificationsPage />)
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  /**
   * The regression this ordering exists for: the prototype rendered its empty state
   * whenever the list was empty, *instead of* the filter bar — which with a real fetch
   * flashes "no notifications" on every page load before the response lands.
   */
  it('does not flash the empty state while loading', () => {
    renderWithProviders(<NotificationsPage />)

    expect(screen.queryByText('No notifications yet')).not.toBeInTheDocument()
    expect(screen.queryByText(/No notifications match/)).not.toBeInTheDocument()
  })

  it("shows the backend's message when the list fails", async () => {
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.list}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Notifications down.' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<NotificationsPage />)

    expect(await screen.findByText('Notifications down.')).toBeInTheDocument()
  })
})

describe('NotificationsPage — the two empty states (BR-14)', () => {
  it('shows the inbox-empty copy and hides the filter bar', async () => {
    clearMockNotifications()
    renderWithProviders(<NotificationsPage />)

    expect(await screen.findByText('No notifications yet')).toBeInTheDocument()
    expect(
      screen.getByText('Updates about your interest tables and bookings will appear here.'),
    ).toBeInTheDocument()
    // Nothing to filter, so the bar is absent — the one case where hiding it is right.
    expect(screen.queryByPlaceholderText('Search notifications…')).not.toBeInTheDocument()
  })

  /** A different situation, and it needs a way back out. */
  it('shows the no-match copy with a clear action, keeping the filter bar', async () => {
    await renderLoaded()

    await userEvent.type(screen.getByPlaceholderText('Search notifications…'), 'zzzz')

    expect(await screen.findByText('No notifications match your filters.')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search notifications…')).toBeInTheDocument()
    // Two of them by design: one on the toolbar, one in the empty state itself, so the way
    // out is reachable whichever the eye lands on first.
    expect(screen.getAllByRole('button', { name: /clear filters/i })).toHaveLength(2)
  })

  it('recovers from the no-match state via clear filters', async () => {
    await renderLoaded()

    await userEvent.type(screen.getByPlaceholderText('Search notifications…'), 'zzzz')
    await screen.findByText('No notifications match your filters.')

    // Two clear affordances exist — the toolbar's and the empty state's; either works.
    await userEvent.click(screen.getAllByRole('button', { name: /clear filters/i })[0])

    expect(await screen.findByText(/Your interest table Startup Mixer/)).toBeInTheDocument()
  })
})

describe('NotificationsPage — server-side filtering', () => {
  it('sends the search term', async () => {
    const queries = trackQueries()
    await renderLoaded()

    await userEvent.type(screen.getByPlaceholderText('Search notifications…'), 'Promingler')

    await waitFor(() => {
      expect(queries().some((query) => query.includes('search=Promingler'))).toBe(true)
    })
  })

  it('sends a type filter chosen from the catalogue', async () => {
    const queries = trackQueries()
    await renderLoaded()

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(
      await screen.findByText('Interest table cancelled', {
        selector: '.ant-select-item-option-content span',
      }),
    )

    await waitFor(() => {
      expect(queries().some((query) => query.includes('type=IT_CANCELLED'))).toBe(true)
    })
  })

  it('sends the status filter', async () => {
    const queries = trackQueries()
    await renderLoaded()

    await userEvent.click(screen.getAllByRole('combobox')[1])
    await userEvent.click(
      await screen.findByText('Unread', { selector: '.ant-select-item-option-content' }),
    )

    await waitFor(() => {
      expect(queries().some((query) => query.includes('status=UNREAD'))).toBe(true)
    })
  })

  it('sends the sort direction both ways', async () => {
    const queries = trackQueries()
    await renderLoaded()

    await userEvent.click(screen.getByRole('button', { name: /newest first/i }))
    await waitFor(() => {
      expect(queries().some((query) => query.includes('sortDir=asc'))).toBe(true)
    })

    await userEvent.click(screen.getByRole('button', { name: /oldest first/i }))
    await waitFor(() => {
      expect(queries().some((query) => query.includes('sortDir=desc'))).toBe(true)
    })
  })

  /**
   * The badge count is the restaurant's, not the page's. With a READ filter it stays put
   * while the rows drop to the read ones.
   */
  it('keeps the read affordances while a READ filter shows only read rows', async () => {
    await renderLoaded()

    await userEvent.click(screen.getAllByRole('combobox')[1])
    await userEvent.click(
      await screen.findByText('Read', { selector: '.ant-select-item-option-content' }),
    )

    await waitFor(() => {
      expect(screen.queryByText('Promingler updated')).not.toBeInTheDocument()
    })
    // Six are still unread, so the action stays.
    expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument()
  })
})

describe('NotificationsPage — paging', () => {
  it('offers only the page sizes the endpoint accepts', async () => {
    await renderLoaded()

    await userEvent.click(screen.getAllByRole('combobox')[2])
    for (const size of ['10 / page', '50 / page']) {
      expect(
        await screen.findByText(size, { selector: '.ant-select-item-option-content' }),
      ).toBeInTheDocument()
    }
    expect(screen.queryByText('100 / page')).not.toBeInTheDocument()
  })

  it('sends a new page size to the server', async () => {
    const queries = trackQueries()
    await renderLoaded()

    await userEvent.click(screen.getAllByRole('combobox')[2])
    await userEvent.click(
      await screen.findByText('10 / page', { selector: '.ant-select-item-option-content' }),
    )

    await waitFor(() => {
      expect(queries().some((query) => query.includes('pageSize=10'))).toBe(true)
    })
  })
})

describe('NotificationsPage — read actions', () => {
  it('marks one read from the link without navigating', async () => {
    await renderLoaded()

    await userEvent.click(screen.getAllByText('Mark as read')[0])

    await waitFor(() => {
      expect(screen.getAllByText('Mark as read').length).toBeLessThan(6)
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  /** The resolver strips the /restaurant-profile prefix the producer writes. */
  it('marks read and navigates on a row click', async () => {
    await renderLoaded()

    await userEvent.click(screen.getByText(/Your interest table Startup Mixer/))

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1')
  })

  it('marks everything read and then removes every affordance', async () => {
    await renderLoaded()

    await userEvent.click(screen.getByRole('button', { name: /mark all as read/i }))

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument()
    })
    expect(screen.queryByText('Mark as read')).not.toBeInTheDocument()
  })

  /** BR-09 — absent from the start when nothing is unread. */
  it('shows no read affordances on an all-read inbox', async () => {
    markAllMockRead()
    await renderLoaded()

    expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument()
    expect(screen.queryByText('Mark as read')).not.toBeInTheDocument()
  })

  it('toasts when marking all read fails', async () => {
    server.use(
      http.patch(`*${NOTIFICATION_ENDPOINTS.markAllRead}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: "Couldn't mark them." } },
          { status: 500 },
        ),
      ),
    )
    await renderLoaded()

    await userEvent.click(screen.getByRole('button', { name: /mark all as read/i }))

    expect(await screen.findByText("Couldn't mark them.")).toBeInTheDocument()
  })
})

describe('NotificationsPage — mobile', () => {
  it('renders the filter button and hides the page-size selector', async () => {
    setViewport(true)
    await renderLoaded()

    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
    expect(screen.queryByText('25 / page')).not.toBeInTheDocument()
  })
})

describe('NotificationsPage — the date range', () => {
  /**
   * One integration test, deliberately. The both-or-neither rule and the three picker
   * outcomes are unit-tested in `dateRange.test.ts` — driving them through AntD's
   * RangePicker means typing into two inputs and clicking a clear icon that only exists on
   * hover, which was slow and intermittently failed on a loaded CI box. This asserts the
   * wiring; that file asserts the rule.
   */
  it('sends both dates once a full range is picked, and drops them when cleared', async () => {
    const queries = trackQueries()
    await renderLoaded()

    const [start, end] = document.querySelectorAll('.ant-picker-input input')
    const from = dayjs().subtract(10, 'day').format('YYYY-MM-DD')
    const to = dayjs().format('YYYY-MM-DD')

    await userEvent.click(start)
    await userEvent.type(start, from)
    await userEvent.keyboard('{Enter}')
    await userEvent.type(end as HTMLElement, to)
    await userEvent.keyboard('{Enter}')

    await waitFor(() => {
      const match = queries().find((query) => query.includes('startDate'))
      expect(match).toContain(`startDate=${from}`)
      expect(match).toContain(`endDate=${to}`)
    })

    // And the picker shows back what the controller now holds.
    expect(start).toHaveValue(from)
    expect(end).toHaveValue(to)

    // Clearing goes through the toolbar rather than the picker's hover-only X: the
    // picker-cleared path itself is covered by `pickedRange`.
    await userEvent.click(screen.getAllByRole('button', { name: /clear filters/i })[0])

    await waitFor(() => {
      expect(start).toHaveValue('')
    })
    const last = queries()[queries().length - 1]
    expect(last).not.toContain('startDate')
    expect(last).not.toContain('endDate')
  })
})

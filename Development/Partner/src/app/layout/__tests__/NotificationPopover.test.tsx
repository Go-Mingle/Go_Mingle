import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import {
  clearMockNotifications,
  markAllMockRead,
  resetMockNotifications,
  setMockUnreadCount,
} from '../../../mocks/data/partnerNotifications'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../shared/auth/tokenStore'
import { NOTIFICATION_ENDPOINTS } from '../../modules/notifications/constants'
import { NotificationPopover } from '../NotificationPopover'

/**
 * Driven through MSW rather than a Redux preload: J7 moved both surfaces onto the API, so
 * `makeStore({ notifications: … })` no longer feeds anything.
 */

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

function renderBell(open = false) {
  const onOpenChange = vi.fn()
  const onViewAll = vi.fn()
  return {
    onOpenChange,
    onViewAll,
    ...renderWithProviders(
      <NotificationPopover open={open} onOpenChange={onOpenChange} onViewAll={onViewAll} />,
    ),
  }
}

/** The panel is a portal, so it is queried from the document rather than the container. */
function panel(): HTMLElement {
  const found = document.querySelector('.w-\\[min\\(360px\\,calc\\(100vw_-_90px\\)\\)\\]')
  if (!found) throw new Error('panel not rendered')
  return found as HTMLElement
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

describe('NotificationPopover — the bell', () => {
  it('announces the unread count', async () => {
    renderBell()

    expect(
      await screen.findByRole('button', { name: 'Notifications, 6 unread' }),
    ).toBeInTheDocument()
  })

  it('shows the count on the badge', async () => {
    const { container } = renderBell()

    await waitFor(() => {
      expect(container.querySelector('.absolute')).toHaveTextContent('6')
    })
  })

  it('caps the badge at 99+', async () => {
    setMockUnreadCount(420)
    const { container } = renderBell()

    await waitFor(() => {
      expect(container.querySelector('.absolute')).toHaveTextContent('99+')
    })
  })

  /** BR-06 — the bell is an outline at zero, never a bell with a nought on it. */
  it('renders no badge at all when everything is read', async () => {
    markAllMockRead()
    const { container } = renderBell()

    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument()
    expect(container.querySelector('.absolute')).toBeNull()
  })

  it('opens on Enter and on Space', async () => {
    const { onOpenChange } = renderBell()
    const bell = await screen.findByRole('button', { name: /Notifications/ })

    bell.focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpenChange).toHaveBeenCalledWith(true)

    onOpenChange.mockClear()
    await userEvent.keyboard(' ')
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})

describe('NotificationPopover — the panel', () => {
  it('lists the newest seven with their stored copy', async () => {
    renderBell(true)

    expect(await screen.findByText('Interest table cancelled')).toBeInTheDocument()
    expect(
      within(panel()).getByText(/Your interest table Startup Mixer scheduled for 12 May 2026/),
    ).toBeInTheDocument()
  })

  it('spins while the panel loads', () => {
    renderBell(true)
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it("shows the backend's message when the panel fails", async () => {
    server.use(
      http.get(`*${NOTIFICATION_ENDPOINTS.recent}`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Notifications down.' } },
          { status: 500 },
        ),
      ),
    )
    renderBell(true)

    expect(await screen.findByText('Notifications down.')).toBeInTheDocument()
  })

  it('shows the empty state for an inbox with nothing in it', async () => {
    clearMockNotifications()
    renderBell(true)

    expect(await screen.findByText("You're all caught up.")).toBeInTheDocument()
  })

  /** BR-07 — always present. The prototype hid it when the list was empty. */
  it('offers "View all" even on an empty inbox', async () => {
    clearMockNotifications()
    const { onViewAll } = renderBell(true)

    const viewAll = await screen.findByText('View all notifications')
    await userEvent.click(viewAll)

    expect(onViewAll).toHaveBeenCalled()
  })

  it('renders the timestamp ladder, not a bare minute count', async () => {
    renderBell(true)

    // The newest fixture is seconds old.
    expect(await screen.findByText('Just now')).toBeInTheDocument()
  })

  /** An unrecognised type is legal and must render (BR-02). */
  it('renders a row whose type is not in the catalogue', async () => {
    renderBell(true)

    expect(await screen.findByText('A new kind of update')).toBeInTheDocument()
  })
})

describe('NotificationPopover — read affordances', () => {
  it('shows the count chip and "Mark all as read" while unread exist', async () => {
    renderBell(true)

    await screen.findByText('Interest table cancelled')
    expect(within(panel()).getByText('Mark all as read')).toBeInTheDocument()
    expect(within(panel()).getAllByText('Mark as read').length).toBeGreaterThan(0)
  })

  /** BR-09 — removed, not disabled. */
  it('removes every read affordance once everything is read', async () => {
    markAllMockRead()
    renderBell(true)

    await screen.findByText('Interest table cancelled')
    expect(within(panel()).queryByText('Mark all as read')).not.toBeInTheDocument()
    expect(within(panel()).queryByText('Mark as read')).not.toBeInTheDocument()
  })

  it('marks one read from the link without navigating', async () => {
    renderBell(true)

    await screen.findByText('Interest table cancelled')
    await userEvent.click(within(panel()).getAllByText('Mark as read')[0])

    await waitFor(() => {
      expect(within(panel()).getAllByText('Mark as read').length).toBeLessThan(6)
    })
    // AC-04.5 — the link stops propagation, so the row's navigation never fires.
    expect(navigate).not.toHaveBeenCalled()
  })

  it('marks everything read and then hides the action', async () => {
    renderBell(true)

    await screen.findByText('Interest table cancelled')
    await userEvent.click(within(panel()).getByText('Mark all as read'))

    await waitFor(() => {
      expect(within(panel()).queryByText('Mark all as read')).not.toBeInTheDocument()
    })
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
    renderBell(true)

    await screen.findByText('Interest table cancelled')
    await userEvent.click(within(panel()).getByText('Mark all as read'))

    expect(await screen.findByText("Couldn't mark them.")).toBeInTheDocument()
  })
})

describe('NotificationPopover — navigation', () => {
  /** The resolver strips the /restaurant-profile prefix the producer writes. */
  it('marks read and navigates to the resolved path on a row click', async () => {
    const { onOpenChange } = renderBell(true)

    await userEvent.click(await screen.findByText('Interest table cancelled'))

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1')
    // The panel closes on the way out.
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('preserves the bookings tab', async () => {
    renderBell(true)

    await userEvent.click(await screen.findByText('Mingler cancelled a booking'))

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1?tab=bookings')
  })

  /** AC-04.4 — a row with no destination marks read and stays put. */
  it('does not navigate for a row with no deep link', async () => {
    renderBell(true)

    await userEvent.click(
      await screen.findByText(/Your interest table Chef’s Tasting Night scheduled for 2 May 2026/),
    )

    expect(navigate).not.toHaveBeenCalled()
  })

  it('opens on Enter from a row', async () => {
    renderBell(true)

    const row = (await screen.findByText('Interest table cancelled')).closest(
      '[role="button"]',
    ) as HTMLElement
    row.focus()
    await userEvent.keyboard('{Enter}')

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1')
  })
})

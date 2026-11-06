import { describe, it, expect, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { __resetNotificationsMock } from '../../../../mocks/handlers/notifications'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { NotificationsPage } from '../NotificationsPage'

const V1 = '/api/v1/notifications'

beforeEach(() => {
  __resetNotificationsMock()
})

describe('NotificationsPage', () => {
  it('renders the title and notification cards from the API', async () => {
    renderWithProviders(<NotificationsPage />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(await screen.findByText('New Restaurant Application')).toBeInTheDocument()
  })

  it('marks all as read, hiding the button once the unread count reaches zero', async () => {
    renderWithProviders(<NotificationsPage />)
    await screen.findByText('New Restaurant Application')
    const user = userEvent.setup()
    const allReadBtn = await screen.findByRole('button', { name: /mark all/i })
    await user.click(allReadBtn)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /mark all/i })).not.toBeInTheDocument(),
    )
  })

  it('shows the "all caught up" empty state when the inbox is genuinely empty (no filters)', async () => {
    server.use(
      http.get(V1, () =>
        HttpResponse.json({
          success: true,
          data: { items: [], pagination: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 } },
        }),
      ),
    )
    renderWithProviders(<NotificationsPage />)
    expect(await screen.findByText(/all caught up/i)).toBeInTheDocument()
    expect(screen.queryByText(/match your filters/i)).not.toBeInTheDocument()
  })

  it('shows the "no match" empty state when a filter is active but nothing matches', async () => {
    renderWithProviders(<NotificationsPage />)
    await screen.findByText('New Restaurant Application')
    const user = userEvent.setup()
    const searchInput = screen.getByPlaceholderText(/search notifications/i)
    await user.type(searchInput, 'zzz-nothing-matches-this')
    expect(await screen.findByText(/match your filters/i)).toBeInTheDocument()
    expect(screen.queryByText(/all caught up/i)).not.toBeInTheDocument()
  })

  it('enforces the 200-character search maxLength on the search input', async () => {
    renderWithProviders(<NotificationsPage />)
    await screen.findByText('New Restaurant Application')
    const searchInput = screen.getByPlaceholderText(/search notifications/i) as HTMLInputElement
    expect(searchInput.maxLength).toBe(200)
  })

  it('marks a notification as read when its card is opened', async () => {
    renderWithProviders(<NotificationsPage />)
    await screen.findByText('New Restaurant Application')
    const user = userEvent.setup()
    // Seed has 3 unread → 3 "Mark as read" buttons.
    const before = await screen.findAllByRole('button', { name: /^mark as read$/i })
    expect(before).toHaveLength(3)
    // Opening the card marks it read; one button disappears after invalidation.
    await user.click(screen.getByText('New Restaurant Application'))
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^mark as read$/i })).toHaveLength(2),
    )
  })

  it('sends the search term as a query param and filters results', async () => {
    let lastSearch = ''
    server.use(
      http.get(V1, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'n2',
                type: 'suspension',
                title: 'Restaurant Suspended',
                body: 'x',
                deepLink: null,
                metadata: {},
                readAt: null,
                readByUserId: null,
                createdAt: '2026-07-07T10:00:00Z',
              },
            ],
            pagination: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<NotificationsPage />)
    const user = userEvent.setup()
    const searchInput = screen.getByPlaceholderText(/search notifications/i)
    await user.type(searchInput, 'suspended')
    await waitFor(() => expect(new URLSearchParams(lastSearch).get('search')).toBe('suspended'))
    expect(await screen.findByText('Restaurant Suspended')).toBeInTheDocument()
  })

  it('toggles the sort order back and forth', async () => {
    renderWithProviders(<NotificationsPage />)
    await screen.findByText('New Restaurant Application')
    const user = userEvent.setup()
    expect(screen.getByText(/newest first/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /newest first/i }))
    expect(await screen.findByText(/oldest first/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /oldest first/i }))
    expect(await screen.findByText(/newest first/i)).toBeInTheDocument()
  })

  it('marks a single notification as read', async () => {
    renderWithProviders(<NotificationsPage />)
    await screen.findByText('New Restaurant Application')
    const user = userEvent.setup()
    const markReadBtns = await screen.findAllByRole('button', { name: /^mark as read$/i })
    await user.click(markReadBtns[0])
    // no throw; unread badge updates via query invalidation
    await waitFor(() => expect(markReadBtns[0]).not.toBeInTheDocument())
  })

  it('filters by type via the type dropdown', async () => {
    renderWithProviders(<NotificationsPage />)
    await screen.findByText('New Restaurant Application')
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[0])
    // Select the "Restaurant suspended" type option (exact match hits the option, not a card title).
    const option = await screen.findByText('Restaurant suspended')
    await user.click(option)
    await waitFor(() =>
      expect(screen.queryByText('New Restaurant Application')).not.toBeInTheDocument(),
    )
    expect(screen.getByText('Restaurant Suspended')).toBeInTheDocument()
  })
})

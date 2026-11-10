import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../mocks/server'
import { __resetNotificationsMock } from '../../../mocks/handlers/notifications'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { NotificationPopover } from '../NotificationPopover'

beforeEach(() => {
  __resetNotificationsMock()
})

function renderPopover(open = true) {
  const onOpenChange = vi.fn()
  const onViewAll = vi.fn()
  const utils = renderWithProviders(
    <NotificationPopover open={open} onOpenChange={onOpenChange} onViewAll={onViewAll} />,
  )
  return { onOpenChange, onViewAll, ...utils }
}

describe('NotificationPopover', () => {
  it('shows the unread-count badge from the API', async () => {
    renderPopover(false)
    // Seed has 3 unread of 4 → badge "3".
    expect(await screen.findByText('3')).toBeInTheDocument()
  })

  it('renders the recent notifications list when open', async () => {
    renderPopover(true)
    expect(await screen.findByText('New Restaurant Application')).toBeInTheDocument()
    expect(screen.getByText('Restaurant Suspended')).toBeInTheDocument()
  })

  it('marks a single notification as read via the API', async () => {
    renderPopover(true)
    const user = userEvent.setup()
    await screen.findByText('New Restaurant Application')
    const markButtons = screen.getAllByText(/mark as read/i)
    await user.click(markButtons[0])
    // Unread count drops after invalidation (3 → 2); badge shows in trigger + header.
    await waitFor(() => expect(screen.getAllByText('2').length).toBeGreaterThan(0))
  })

  it('marks all as read via the API', async () => {
    renderPopover(true)
    const user = userEvent.setup()
    await screen.findByText('New Restaurant Application')
    await user.click(screen.getByRole('button', { name: /mark all/i }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /mark all/i })).not.toBeInTheDocument(),
    )
  })

  it('invokes onViewAll from the footer', async () => {
    const { onViewAll } = renderPopover(true)
    const user = userEvent.setup()
    await user.click(await screen.findByText(/view all/i))
    expect(onViewAll).toHaveBeenCalled()
  })

  it('shows at most 10 recent notifications in the dropdown', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `x${i + 1}`,
      type: 'RESTAURANT_APPROVED',
      title: `Notif ${i + 1}`,
      body: 'body',
      deepLink: null,
      metadata: {},
      readAt: '2026-07-06T12:00:00Z',
      readByUserId: 'u1',
      createdAt: `2026-07-${String(28 - i).padStart(2, '0')}T10:00:00Z`,
    }))
    server.use(
      http.get('/api/v1/notifications/recent', () =>
        HttpResponse.json({ success: true, data: { items: many } }),
      ),
    )
    renderPopover(true)
    expect(await screen.findByText('Notif 1')).toBeInTheDocument()
    expect(screen.getByText('Notif 10')).toBeInTheDocument()
    expect(screen.queryByText('Notif 11')).not.toBeInTheDocument()
    expect(screen.queryByText('Notif 12')).not.toBeInTheDocument()
  })

  it('closes the popover when a notification row is clicked', async () => {
    const { onOpenChange } = renderPopover(true)
    const user = userEvent.setup()
    const row = await screen.findByText('New Restaurant Application')
    await user.click(row)
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('renders the empty state when there are no recent notifications', async () => {
    server.use(
      http.get('/api/v1/notifications/recent', () =>
        HttpResponse.json({ success: true, data: { items: [] } }),
      ),
      http.get('/api/v1/notifications/unread-count', () =>
        HttpResponse.json({ success: true, data: { count: 0 } }),
      ),
    )
    renderPopover(true)
    expect(await screen.findByText(/no notifications|all caught up|empty/i)).toBeInTheDocument()
  })
})

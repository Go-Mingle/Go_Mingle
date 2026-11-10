import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { NotificationCard } from '../NotificationCard'
import type { NotificationItem } from '../types'

const baseNotif: NotificationItem = {
  id: '1',
  type: 'RESTAURANT_APPLICATION_SUBMITTED',
  title: 'Title',
  body: 'Body',
  deepLink: '/admin/approvals/rest1',
  metadata: { restaurantId: 'rest1' },
  readAt: null,
  readByUserId: null,
  // Real API format: DD-MM-YYYY HH:MM.
  createdAt: '16-07-2026 13:19',
}

describe('NotificationCard', () => {
  it('renders title, body and the formatted date from a DD-MM-YYYY createdAt', () => {
    renderWithProviders(<NotificationCard notification={baseNotif} onMarkRead={() => {}} />)
    expect(screen.getByText('Title')).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('16 Jul 2026, 1:19 PM')).toBeInTheDocument()
  })

  it('calls onMarkRead without triggering onOpen when the button is clicked', async () => {
    const onMarkRead = vi.fn()
    const onOpen = vi.fn()
    renderWithProviders(
      <NotificationCard notification={baseNotif} onMarkRead={onMarkRead} onOpen={onOpen} />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /mark as read/i }))
    expect(onMarkRead).toHaveBeenCalledWith('1')
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('calls onOpen when the card body is clicked', async () => {
    const onOpen = vi.fn()
    renderWithProviders(
      <NotificationCard notification={baseNotif} onMarkRead={() => {}} onOpen={onOpen} />,
    )
    await userEvent.setup().click(screen.getByText('Body'))
    expect(onOpen).toHaveBeenCalledWith(baseNotif)
  })

  it('hides mark as read button when read', () => {
    renderWithProviders(
      <NotificationCard
        notification={{ ...baseNotif, readAt: '2026-05-09T00:00:00Z' }}
        onMarkRead={() => {}}
      />,
    )
    expect(screen.queryByRole('button', { name: /mark as read/i })).not.toBeInTheDocument()
  })

  it.each([
    'RESTAURANT_APPLICATION_SUBMITTED',
    'RESTAURANT_APPROVED',
    'RESTAURANT_REJECTED',
    'RESTAURANT_SUSPENDED',
    'RESTAURANT_UNSUSPENDED',
    'MINGLER_SUSPENDED',
    'MINGLER_UNSUSPENDED',
    'SOME_UNKNOWN_TYPE',
  ])('renders for type %s', (type) => {
    renderWithProviders(
      <NotificationCard notification={{ ...baseNotif, type }} onMarkRead={() => {}} />,
    )
    expect(screen.getByText('Title')).toBeInTheDocument()
  })
})

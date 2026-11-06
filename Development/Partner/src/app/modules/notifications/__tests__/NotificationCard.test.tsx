import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { NotificationCard } from '../NotificationCard'
import type { NotificationItem } from '../types'

const UNREAD: NotificationItem = {
  id: 'n-1',
  type: 'IT_CANCELLED',
  title: 'Interest table cancelled',
  body: 'Your interest table Startup Mixer scheduled for 12 May 2026 has been cancelled.',
  deepLink: '/restaurant-profile/interest-tables/it-1',
  metadata: { interestTableId: 'it-1' },
  isRead: false,
  createdAt: new Date(Date.now() - 30_000).toISOString(),
}

function make(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return { ...UNREAD, ...overrides }
}

function renderCard(notification = UNREAD) {
  const onOpen = vi.fn()
  const onMarkRead = vi.fn()
  return {
    onOpen,
    onMarkRead,
    ...renderWithProviders(
      <NotificationCard notification={notification} onOpen={onOpen} onMarkRead={onMarkRead} />,
    ),
  }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('NotificationCard — content', () => {
  it('renders the stored title and body verbatim', () => {
    renderCard()

    expect(screen.getByText('Interest table cancelled')).toBeInTheDocument()
    expect(screen.getByText(/Your interest table Startup Mixer/)).toBeInTheDocument()
  })

  it('renders the timestamp through the shared ladder', () => {
    renderCard()
    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  it('renders an icon for the type', () => {
    const { container } = renderCard()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  /** An unrecognised type is legal and must render rather than crash (BR-02). */
  it('renders a row whose type is not in the catalogue', () => {
    const { container } = renderCard(make({ type: 'SOMETHING_NEW' }))

    expect(screen.getByText('Interest table cancelled')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})

describe('NotificationCard — read affordances', () => {
  it('shows a dot, a bold title and the link while unread', () => {
    renderCard()

    expect(screen.getByText('Mark as read')).toBeInTheDocument()
    expect(screen.getByText('Interest table cancelled')).toHaveClass('font-semibold')
  })

  /** BR-09 — removed, not disabled, and the title drops to regular weight. */
  it('removes them once read', () => {
    renderCard(make({ isRead: true }))

    expect(screen.queryByText('Mark as read')).not.toBeInTheDocument()
    expect(screen.getByText('Interest table cancelled')).toHaveClass('font-medium')
  })

  it('tints an unread row and leaves a read one untinted', () => {
    const { container: unread } = renderCard()
    expect(unread.querySelector('.notif-row')?.className).toContain('rgba(15,167,157,0.04)')

    const { container: read } = renderCard(make({ isRead: true }))
    expect(read.querySelector('.notif-row')?.className).toContain('bg-transparent')
  })
})

describe('NotificationCard — interaction', () => {
  it('asks the caller to open on a body click', async () => {
    const { onOpen } = renderCard()

    await userEvent.click(screen.getByText('Interest table cancelled'))

    expect(onOpen).toHaveBeenCalledWith(UNREAD)
  })

  it('opens on Enter and on Space', async () => {
    const { onOpen, container } = renderCard()
    // The row and the "Mark as read" link are both buttons; this is the row.
    const row = container.querySelector('.notif-row') as HTMLElement

    row.focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledTimes(1)

    await userEvent.keyboard(' ')
    expect(onOpen).toHaveBeenCalledTimes(2)
  })

  it('ignores other keys', async () => {
    const { onOpen, container } = renderCard()

    ;(container.querySelector('.notif-row') as HTMLElement).focus()
    await userEvent.keyboard('{Escape}')

    expect(onOpen).not.toHaveBeenCalled()
  })

  /**
   * AC-04.5 — the link marks read and stays put. Without `stopPropagation` the row's own
   * handler fires too and navigates the partner away.
   */
  it('marks read from the link without also opening the row', async () => {
    const { onOpen, onMarkRead } = renderCard()

    await userEvent.click(screen.getByText('Mark as read'))

    expect(onMarkRead).toHaveBeenCalledWith('n-1')
    expect(onOpen).not.toHaveBeenCalled()
  })
})

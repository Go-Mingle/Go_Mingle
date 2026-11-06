import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { NotificationTimestamp } from '../components/NotificationTimestamp'

const NOW = new Date('2026-05-08T15:14:00+05:00')

function freeze() {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
}

/** `NOW` minus an offset, carrying the +05:00 offset the wire uses. */
function ago(ms: number): string {
  const at = new Date(NOW.getTime() - ms)
  return `${new Date(at.getTime() + 5 * 3_600_000).toISOString().slice(0, 19)}+05:00`
}

afterEach(() => {
  vi.useRealTimers()
})

describe('NotificationTimestamp', () => {
  it('renders "Just now" under a minute', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(20_000)} />)

    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  /** The plural forms are the reason these keys carry `_one`/`_other`. */
  it('uses the singular for one minute', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(60_000)} />)

    expect(screen.getByText('1 minute ago')).toBeInTheDocument()
  })

  it('uses the plural for several minutes', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(12 * 60_000)} />)

    expect(screen.getByText('12 minutes ago')).toBeInTheDocument()
  })

  it('uses the singular for one hour', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(3_600_000)} />)

    expect(screen.getByText('1 hour ago')).toBeInTheDocument()
  })

  it('uses the plural for several hours', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(5 * 3_600_000)} />)

    expect(screen.getByText('5 hours ago')).toBeInTheDocument()
  })

  it('uses the singular for one day', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(86_400_000)} />)

    expect(screen.getByText('1 day ago')).toBeInTheDocument()
  })

  it('uses the plural for several days', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(4 * 86_400_000)} />)

    expect(screen.getByText('4 days ago')).toBeInTheDocument()
  })

  /** The cutover at seven days, and the one portal date that is not DD-MM-YYYY. */
  it('switches to an absolute Karachi date at seven days', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt="2026-04-20T14:14:00+05:00" />)

    expect(screen.getByText('20 Apr 2026, 2:14 PM')).toBeInTheDocument()
  })

  it('reads a future timestamp as "Just now" rather than a negative count', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(-90_000)} />)

    expect(screen.getByText('Just now')).toBeInTheDocument()
  })

  it('carries the text as a title for truncated layouts', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(20_000)} />)

    expect(screen.getByText('Just now')).toHaveAttribute('title', 'Just now')
  })

  it('applies a caller class', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt={ago(20_000)} className="text-xs" />)

    expect(screen.getByText('Just now')).toHaveClass('text-xs')
  })

  /** Never "Invalid Date" — show what arrived. */
  it('falls back to the raw value for an unparseable timestamp', () => {
    freeze()
    renderWithProviders(<NotificationTimestamp createdAt="not-a-date" />)

    expect(screen.getByText('not-a-date')).toBeInTheDocument()
  })
})

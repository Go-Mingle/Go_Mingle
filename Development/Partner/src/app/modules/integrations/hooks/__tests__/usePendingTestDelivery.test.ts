import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import {
  TEST_DELIVERY_CLOCK_SKEW_MS,
  TEST_DELIVERY_CONFIRM_WINDOW_MS,
} from '../../constants'
import type { WebhookDeliveriesPage, WebhookDelivery, WebhookEventType } from '../../types'
import {
  usePendingDeliveryRow,
  usePendingTestDelivery,
  type PendingTestDelivery,
} from '../usePendingTestDelivery'

/**
 * MET-1277 — a test send is accepted (202) long before its delivery record
 * exists. These cover the interval in between: what the partner is shown, how
 * the marker is matched to the server's eventual row, and what happens when
 * that row never turns up.
 */

function wrapper({ children }: { children: ReactNode }) {
  return createElement(AllProviders, { queryClient: makeQueryClient(), children })
}

function serverRow(overrides: Partial<WebhookDelivery> = {}): WebhookDelivery {
  return {
    eventType: 'BOOKING_CREATED',
    eventLabel: 'Booking · Created',
    tries: 1,
    reason: null,
    whenRelative: 'just now',
    occurredAt: new Date(Date.now()).toISOString(),
    status: 'DELIVERED',
    isTest: true,
    ...overrides,
  }
}

function page(items: WebhookDelivery[]): WebhookDeliveriesPage {
  return {
    items,
    pagination: { page: 1, pageSize: 8, totalRecords: items.length, totalPages: 1 },
  }
}

function pendingFor(
  eventType: WebhookEventType = 'BOOKING_CREATED',
  overrides: Partial<PendingTestDelivery> = {},
): PendingTestDelivery {
  return { eventType, sentAt: Date.now(), unconfirmed: false, ...overrides }
}

describe('usePendingTestDelivery', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('tracks nothing until a test is sent', () => {
    const { result } = renderHook(() => usePendingTestDelivery(), { wrapper })
    expect(result.current.pending).toBeNull()
    expect(result.current.pollDeliveries).toBe(false)
  })

  it('starts polling the moment a send is accepted', () => {
    const { result } = renderHook(() => usePendingTestDelivery(), { wrapper })

    act(() => {
      result.current.startPendingTest('INTEREST_TABLE_PUBLISHED')
    })

    expect(result.current.pending?.eventType).toBe('INTEREST_TABLE_PUBLISHED')
    expect(result.current.pending?.unconfirmed).toBe(false)
    expect(result.current.pollDeliveries).toBe(true)
  })

  it('keeps polling for the whole confirmation window', () => {
    const { result } = renderHook(() => usePendingTestDelivery(), { wrapper })
    act(() => {
      result.current.startPendingTest('BOOKING_CREATED')
    })

    act(() => {
      vi.advanceTimersByTime(TEST_DELIVERY_CONFIRM_WINDOW_MS - 1_000)
    })

    // QA gave up at 150s; the UI must not give up before its own stated window.
    expect(result.current.pollDeliveries).toBe(true)
    expect(result.current.pending?.unconfirmed).toBe(false)
  })

  /** Polling forever would be the other failure mode — noise with no answer. */
  it('stops polling and marks the send unconfirmed once the window closes', () => {
    const { result } = renderHook(() => usePendingTestDelivery(), { wrapper })
    act(() => {
      result.current.startPendingTest('BOOKING_CREATED')
    })

    act(() => {
      vi.advanceTimersByTime(TEST_DELIVERY_CONFIRM_WINDOW_MS + 1_000)
    })

    expect(result.current.pending?.unconfirmed).toBe(true)
    expect(result.current.pollDeliveries).toBe(false)
    // Still tracked — the partner is told it never landed rather than the row
    // simply disappearing.
    expect(result.current.pending).not.toBeNull()
  })

  it('drops the send when cleared', () => {
    const { result } = renderHook(() => usePendingTestDelivery(), { wrapper })
    act(() => {
      result.current.startPendingTest('BOOKING_CREATED')
    })
    act(() => {
      result.current.clearPendingTest()
    })

    expect(result.current.pending).toBeNull()
    expect(result.current.pollDeliveries).toBe(false)
  })

  it('restarts the wait when a second test is sent', () => {
    const { result } = renderHook(() => usePendingTestDelivery(), { wrapper })
    act(() => {
      result.current.startPendingTest('BOOKING_CREATED')
    })
    act(() => {
      vi.advanceTimersByTime(TEST_DELIVERY_CONFIRM_WINDOW_MS + 1_000)
    })
    expect(result.current.pending?.unconfirmed).toBe(true)

    act(() => {
      result.current.startPendingTest('BOOKING_CANCELLED')
    })

    expect(result.current.pending?.eventType).toBe('BOOKING_CANCELLED')
    expect(result.current.pending?.unconfirmed).toBe(false)
    expect(result.current.pollDeliveries).toBe(true)
  })

  it('does not leave the window timer running after unmount', () => {
    const { result, unmount } = renderHook(() => usePendingTestDelivery(), { wrapper })
    act(() => {
      result.current.startPendingTest('BOOKING_CREATED')
    })
    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('usePendingDeliveryRow', () => {
  it('shows no marker when nothing is outstanding', () => {
    const onRecorded = vi.fn()
    const { result } = renderHook(() => usePendingDeliveryRow(null, page([]), onRecorded), {
      wrapper,
    })

    expect(result.current.pendingRow).toBeNull()
    expect(result.current.awaitingTestDelivery).toBe(false)
    expect(onRecorded).not.toHaveBeenCalled()
  })

  /** The heart of the ticket: a 202 with an empty log is now a visible state. */
  it('shows a queued marker while the log has not caught up', () => {
    const { result } = renderHook(
      () => usePendingDeliveryRow(pendingFor(), page([]), vi.fn()),
      { wrapper },
    )

    const row = result.current.pendingRow
    expect(row?.status).toBe('QUEUED')
    expect(row?.isTest).toBe(true)
    expect(row?.pending).toBe(true)
    expect(row?.eventLabel).toBe('Booking · Created')
    expect(result.current.awaitingTestDelivery).toBe(true)
    expect(result.current.testDeliveryUnconfirmed).toBe(false)
  })

  /** Neither delivered nor failed — the outcome genuinely is not known yet. */
  it('claims no attempt count or failure reason for a queued marker', () => {
    const { result } = renderHook(
      () => usePendingDeliveryRow(pendingFor(), page([]), vi.fn()),
      { wrapper },
    )

    expect(result.current.pendingRow?.tries).toBe(0)
    expect(result.current.pendingRow?.reason).toBeNull()
  })

  it('hands the row back to the server record once it arrives', () => {
    const onRecorded = vi.fn()
    const pending = pendingFor()
    const { result } = renderHook(
      () => usePendingDeliveryRow(pending, page([serverRow()]), onRecorded),
      { wrapper },
    )

    // Dropped in the same render that shows the real row, so the two never
    // appear together.
    expect(result.current.pendingRow).toBeNull()
    expect(result.current.awaitingTestDelivery).toBe(false)
    expect(onRecorded).toHaveBeenCalled()
  })

  it('is not satisfied by a live delivery that happens to be recent', () => {
    const { result } = renderHook(
      () => usePendingDeliveryRow(pendingFor(), page([serverRow({ isTest: false })]), vi.fn()),
      { wrapper },
    )
    expect(result.current.pendingRow).not.toBeNull()
  })

  it('is not satisfied by a test of a different event', () => {
    const { result } = renderHook(
      () =>
        usePendingDeliveryRow(
          pendingFor('BOOKING_CREATED'),
          page([serverRow({ eventType: 'BOOKING_CANCELLED' })]),
          vi.fn(),
        ),
      { wrapper },
    )
    expect(result.current.pendingRow).not.toBeNull()
  })

  /** Otherwise yesterday's test would clear today's marker on sight. */
  it('is not satisfied by an earlier test of the same event', () => {
    const stale = serverRow({ occurredAt: new Date(Date.now() - 60 * 60_000).toISOString() })
    const { result } = renderHook(() => usePendingDeliveryRow(pendingFor(), page([stale]), vi.fn()), {
      wrapper,
    })
    expect(result.current.pendingRow).not.toBeNull()
  })

  /** The server stamps `occurredAt`; the browser stamps `sentAt`. */
  it('tolerates a server clock running slightly behind the browser', () => {
    const skewed = serverRow({
      occurredAt: new Date(Date.now() - (TEST_DELIVERY_CLOCK_SKEW_MS - 5_000)).toISOString(),
    })
    const { result } = renderHook(() => usePendingDeliveryRow(pendingFor(), page([skewed]), vi.fn()), {
      wrapper,
    })
    expect(result.current.pendingRow).toBeNull()
  })

  it('ignores a row with an unparseable timestamp rather than matching it', () => {
    const { result } = renderHook(
      () => usePendingDeliveryRow(pendingFor(), page([serverRow({ occurredAt: 'not-a-date' })]), vi.fn()),
      { wrapper },
    )
    expect(result.current.pendingRow).not.toBeNull()
  })

  it('keeps the marker while the log has not loaded at all', () => {
    const { result } = renderHook(() => usePendingDeliveryRow(pendingFor(), undefined, vi.fn()), {
      wrapper,
    })
    expect(result.current.pendingRow?.status).toBe('QUEUED')
  })

  /** "Stop implying it will arrive" — the row says so instead of going green. */
  it('says the record never arrived once the wait is over', () => {
    const { result } = renderHook(
      () => usePendingDeliveryRow(pendingFor('BOOKING_CREATED', { unconfirmed: true }), page([]), vi.fn()),
      { wrapper },
    )

    expect(result.current.testDeliveryUnconfirmed).toBe(true)
    expect(result.current.pendingRow?.status).toBe('QUEUED')
    expect(result.current.pendingRow?.reason).toMatch(/not recorded yet/i)
  })
})

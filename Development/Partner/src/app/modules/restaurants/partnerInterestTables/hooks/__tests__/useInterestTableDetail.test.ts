import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { server } from '../../../../../../mocks/server'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  mockInterestTableBooking,
  mockInvitee,
  resetMockInterestTables,
} from '../../../../../../mocks/data/partnerInterestTables'
import { useInterestTableDetail } from '../useInterestTableDetail'
import type { InterestTableBookingRow, InviteeRow } from '../../types'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()
const feedback = { showSuccess, showError, showErrorText }

type Controller = ReturnType<typeof useInterestTableDetail>

function renderDetail(itId: string | undefined = 'it-1', route = '/interest-tables/it-1') {
  const queryClient = makeQueryClient()
  return renderHook(() => useInterestTableDetail(itId, feedback), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, route, children }),
  })
}

async function renderLoaded(itId = 'it-1', route?: string) {
  const view = renderDetail(itId, route)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

const bookingByRef = (c: Controller, ref: string): InterestTableBookingRow => {
  const found = c.bookings.find((row) => row.bookingRef === ref)
  if (!found) throw new Error(`no seeded booking ${ref}`)
  return found
}

const inviteeByStatus = (c: Controller, status: InviteeRow['inviteStatus']): InviteeRow => {
  const found = c.invitees.find((row) => row.inviteStatus === status)
  if (!found) throw new Error(`no seeded invitee ${status}`)
  return found
}

/** Writes only — the reads fire on mount and are not what these assert. */
function trackWrites() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.method === 'POST') seen.push(new URL(request.url).pathname)
  })
  return () => seen
}

beforeEach(() => {
  resetMockProfile()
  setMockProfileStatus('ACTIVE')
  resetMockInterestTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  showSuccess.mockClear()
  showError.mockClear()
  showErrorText.mockClear()
})

afterEach(() => {
  server.events.removeAllListeners()
})

describe('useInterestTableDetail — loading', () => {
  it('loads the table with all four datasets', async () => {
    const { result } = await renderLoaded()

    expect(result.current.table?.name).toBe('Friday Wine Evening')
    await waitFor(() => {
      expect(result.current.menuOptions.length).toBeGreaterThan(0)
      expect(result.current.bookings.length).toBeGreaterThan(0)
      expect(result.current.invitees.length).toBeGreaterThan(0)
    })
  })

  it('stays idle without an id', () => {
    const { result } = renderDetail(undefined)

    expect(result.current.table).toBeUndefined()
  })

  it('treats a Draft table as not found rather than an error', async () => {
    const { result } = await renderLoaded('it-draft')

    // A Draft deep link is an expected outcome (BR-03), not a failure worth an
    // alarming error panel.
    await waitFor(() => {
      expect(result.current.notFound).toBe(true)
    })
    expect(result.current.isError).toBe(false)
  })

  it('treats an unknown id as not found', async () => {
    const { result } = await renderLoaded('it-nope')

    await waitFor(() => {
      expect(result.current.notFound).toBe(true)
    })
  })

  it('does not toast a failed read', async () => {
    await renderLoaded('it-nope')

    // Reads render inline; only mutations toast.
    expect(showErrorText).not.toHaveBeenCalled()
  })
})

describe('useInterestTableDetail — the Invited tab gate', () => {
  it('reports inviteOnly for an Invite Only table', async () => {
    const { result } = await renderLoaded('it-1')

    await waitFor(() => {
      expect(result.current.inviteOnly).toBe(true)
    })
  })

  it('reports false for a public table, so the tab is hidden entirely', async () => {
    const { result } = await renderLoaded('it-open', '/interest-tables/it-open')

    await waitFor(() => {
      expect(result.current.inviteesPending).toBe(false)
    })
    // Not an empty state — the tab should not exist.
    expect(result.current.inviteOnly).toBe(false)
    expect(result.current.invitees).toEqual([])
  })
})

describe('useInterestTableDetail — tab state in the URL', () => {
  it('defaults to overview', async () => {
    const { result } = await renderLoaded()

    expect(result.current.activeTab).toBe('overview')
  })

  it('reads the tab from the query string', async () => {
    const { result } = await renderLoaded('it-1', '/interest-tables/it-1?tab=bookings')

    expect(result.current.activeTab).toBe('bookings')
  })

  it('writes the tab into the query string', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.setActiveTab('invited')
    })

    await waitFor(() => {
      expect(result.current.activeTab).toBe('invited')
    })
  })

  it('keeps overview out of the URL', async () => {
    const { result } = await renderLoaded('it-1', '/interest-tables/it-1?tab=bookings')

    act(() => {
      result.current.setActiveTab('overview')
    })

    await waitFor(() => {
      expect(result.current.activeTab).toBe('overview')
    })
  })

  it('preserves the menu-options key as `combos` so bookmarks survive', async () => {
    const { result } = await renderLoaded('it-1', '/interest-tables/it-1?tab=combos')

    expect(result.current.activeTab).toBe('combos')
  })
})

describe('useInterestTableDetail — the ACTIVE-only cancel gate (BR-07)', () => {
  it('allows cancelling while ACTIVE', async () => {
    const { result } = await renderLoaded()

    await waitFor(() => {
      expect(result.current.canCancel).toBe(true)
    })
  })

  it.each([['PENDING'], ['DRAFT'], ['REJECTED']] as const)(
    'forbids cancelling while %s',
    async (status) => {
      // Deliberately stricter than J6A's `editable`, which permits DRAFT and REJECTED.
      setMockProfileStatus(status)
      const { result } = await renderLoaded()

      await waitFor(() => {
        expect(result.current.canCancel).toBe(false)
      })
      // The views themselves still render in every state.
      expect(result.current.table?.name).toBe('Friday Wine Evening')
    },
  )
})

describe('useInterestTableDetail — cancel a booking (US-03)', () => {
  it('cancels an eligible booking and reports success', async () => {
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.bookings.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.requestCancelBooking(bookingByRef(result.current, 'BK-10044'))
    })
    expect(result.current.bookingTarget?.bookingRef).toBe('BK-10044')

    act(() => {
      result.current.confirmCancelBooking()
    })

    await waitFor(() => {
      expect(result.current.bookingTarget).toBeNull()
    })
    expect(mockInterestTableBooking('bk-2')?.status).toBe('CANCELLED')
    expect(showSuccess).toHaveBeenCalled()
  })

  it('closes an open popup, whose status the server just changed', async () => {
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.bookings.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.openBooking('bk-2')
    })
    act(() => {
      result.current.requestCancelBooking(bookingByRef(result.current, 'BK-10044'))
    })
    act(() => {
      result.current.confirmCancelBooking()
    })

    await waitFor(() => {
      expect(result.current.openBookingId).toBeNull()
    })
  })

  it('toasts the Promingler refusal and closes the dialog', async () => {
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.bookings.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.requestCancelBooking(bookingByRef(result.current, 'BK-10043'))
    })
    act(() => {
      result.current.confirmCancelBooking()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(result.current.bookingTarget).toBeNull()
  })

  it('toasts the read-only refusal outside ACTIVE', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.bookings.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.requestCancelBooking(bookingByRef(result.current, 'BK-10044'))
    })
    act(() => {
      result.current.confirmCancelBooking()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalledWith(
        "Your application is under review and can't be edited right now.",
      )
    })
  })

  it('cancelling the dialog writes nothing', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.bookings.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.requestCancelBooking(bookingByRef(result.current, 'BK-10044'))
    })
    act(() => {
      result.current.cancelBookingDialog()
    })

    expect(result.current.bookingTarget).toBeNull()
    expect(writes()).toHaveLength(0)
  })

  it('confirming with no target is a no-op', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.confirmCancelBooking()
    })

    expect(writes()).toHaveLength(0)
  })
})

describe('useInterestTableDetail — cancel an invite (US-04)', () => {
  it('cancels an INVITED invite', async () => {
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.invitees.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.requestCancelInvite(inviteeByStatus(result.current, 'INVITED'))
    })
    act(() => {
      result.current.confirmCancelInvite()
    })

    await waitFor(() => {
      expect(result.current.inviteTarget).toBeNull()
    })
    expect(mockInvitee('inv-1')?.inviteStatus).toBe('CANCELLED')
    expect(showSuccess).toHaveBeenCalled()
  })

  it('toasts the refusal for a TABLE_BOOKED invite', async () => {
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.invitees.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.requestCancelInvite(inviteeByStatus(result.current, 'TABLE_BOOKED'))
    })
    act(() => {
      result.current.confirmCancelInvite()
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(result.current.inviteTarget).toBeNull()
  })

  it('cancelling the dialog writes nothing', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.invitees.length).toBeGreaterThan(0)
    })

    act(() => {
      result.current.requestCancelInvite(inviteeByStatus(result.current, 'INVITED'))
    })
    act(() => {
      result.current.cancelInviteDialog()
    })

    expect(result.current.inviteTarget).toBeNull()
    expect(writes()).toHaveLength(0)
  })

  it('confirming with no target is a no-op', async () => {
    const writes = trackWrites()
    const { result } = await renderLoaded()

    act(() => {
      result.current.confirmCancelInvite()
    })

    expect(writes()).toHaveLength(0)
  })

  it('is a no-op without a table id', () => {
    const writes = trackWrites()
    const { result } = renderDetail(undefined)

    act(() => {
      result.current.confirmCancelInvite()
    })

    expect(writes()).toHaveLength(0)
  })
})

describe('useInterestTableDetail — the modals', () => {
  /**
   * The controller tracks *which* booking is open; the detail read itself moved into
   * `BookingDetailsModal` so J6G's Reviews tab can open the same popup from a review
   * row. The payload and its loading/error states are covered in `detailPanels.test.tsx`.
   */
  it('tracks the open booking', async () => {
    const { result } = await renderLoaded()

    expect(result.current.openBookingId).toBeNull()

    act(() => {
      result.current.openBooking('bk-2')
    })
    expect(result.current.openBookingId).toBe('bk-2')

    act(() => {
      result.current.closeBooking()
    })
    expect(result.current.openBookingId).toBeNull()
  })

  it('tracks the open Mingler', async () => {
    const { result } = await renderLoaded()

    act(() => {
      result.current.openMingler('m-sana')
    })
    expect(result.current.openMinglerId).toBe('m-sana')

    act(() => {
      result.current.closeMingler()
    })
    expect(result.current.openMinglerId).toBeNull()
  })
})

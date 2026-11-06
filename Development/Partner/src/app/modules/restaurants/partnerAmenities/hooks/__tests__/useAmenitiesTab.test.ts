import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  mockAmenitySelected,
  resetMockAmenities,
  retireMockAmenity,
} from '../../../../../../mocks/data/partnerAmenities'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_AMENITIES_ENDPOINTS } from '../../constants'
import { useAmenitiesTab } from '../useAmenitiesTab'
import type { CatalogueAmenity } from '../../types'

const showSuccess = vi.fn()
const showError = vi.fn()
const showErrorText = vi.fn()
const feedback = { showSuccess, showError, showErrorText }

function renderTab(editable = true) {
  const queryClient = makeQueryClient()
  const view = renderHook(() => useAmenitiesTab(editable, feedback), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

async function renderLoaded(editable = true) {
  const view = renderTab(editable)
  await waitFor(() => {
    expect(view.result.current.isPending).toBe(false)
  })
  return view
}

const find = (list: CatalogueAmenity[], name: string): CatalogueAmenity => {
  const found = list.find((item) => item.name === name)
  if (!found) throw new Error(`no seeded amenity named ${name}`)
  return found
}

/** Counts requests to the amenities endpoints, for the client-side search proof. */
function countRequests() {
  const seen: string[] = []
  server.events.on('request:start', ({ request }) => {
    if (request.url.includes('/restaurant/amenities')) seen.push(`${request.method} ${request.url}`)
  })
  return () => seen
}

beforeEach(() => {
  resetMockProfile()
  resetMockAmenities()
  showSuccess.mockClear()
  showError.mockClear()
  showErrorText.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useAmenitiesTab — loading', () => {
  it('loads the catalogue with its selection flags', async () => {
    const { result } = await renderLoaded()

    expect(result.current.amenities.length).toBeGreaterThan(0)
    expect(result.current.totalCount).toBe(result.current.amenities.length)
    expect(result.current.isError).toBe(false)
  })

  it('surfaces a failed read as an error state, not an empty list', async () => {
    server.use(
      http.get(`*${PARTNER_AMENITIES_ENDPOINTS.list}`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL', message: 'nope' } }, { status: 500 }),
      ),
    )
    const { result } = renderTab()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(result.current.amenities).toEqual([])
  })
})

describe('useAmenitiesTab — search (BR-08)', () => {
  it('filters case-insensitively', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySearch('WI-FI'))

    expect(result.current.amenities.map((item) => item.name)).toEqual(['Wi-Fi free'])
  })

  it('matches mid-string, not just the prefix', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySearch('parking'))

    expect(result.current.amenities.map((item) => item.name)).toEqual(['Valet Parking'])
  })

  it('ignores surrounding whitespace', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySearch('   sea   '))

    expect(result.current.amenities.map((item) => item.name)).toEqual(['Sea view'])
  })

  it('restores the full list when cleared', async () => {
    const { result } = await renderLoaded()
    const total = result.current.totalCount

    act(() => result.current.applySearch('sea'))
    act(() => result.current.applySearch(''))

    expect(result.current.amenities).toHaveLength(total)
  })

  it('reports no matches without losing the catalogue count', async () => {
    const { result } = await renderLoaded()
    act(() => result.current.applySearch('zzzz'))

    expect(result.current.amenities).toEqual([])
    // The tab uses this to tell "no matches" from "empty catalogue".
    expect(result.current.totalCount).toBeGreaterThan(0)
  })

  /** The whole point of BR-08: filtering must not touch the network. */
  it('issues no request while searching', async () => {
    const requests = countRequests()
    const { result } = await renderLoaded()
    const afterLoad = requests().length

    act(() => result.current.applySearch('sea'))
    act(() => result.current.applySearch('valet'))
    act(() => result.current.applySearch(''))

    expect(requests()).toHaveLength(afterLoad)
    server.events.removeAllListeners()
  })
})

describe('useAmenitiesTab — the optimistic toggle', () => {
  it('assigns an amenity and persists it', async () => {
    const { result } = await renderLoaded()
    const target = find(result.current.amenities, 'Sea view')

    act(() => {
      result.current.toggle(target, true)
    })

    await waitFor(() => {
      expect(find(result.current.amenities, 'Sea view').selected).toBe(true)
    })
    await waitFor(() => {
      expect(mockAmenitySelected(target.amenityId)).toBe(true)
    })
  })

  it('un-assigns an amenity', async () => {
    const { result } = await renderLoaded()
    const target = find(result.current.amenities, 'Wi-Fi free')

    act(() => {
      result.current.toggle(target, false)
    })

    await waitFor(() => {
      expect(find(result.current.amenities, 'Wi-Fi free').selected).toBe(false)
    })
    await waitFor(() => {
      expect(mockAmenitySelected(target.amenityId)).toBe(false)
    })
  })

  /**
   * The point of the optimistic write: the switch moves while the request is
   * still in flight. Holding the response open proves that, rather than merely
   * showing the two eventually agree.
   */
  it('flips the switch before the server has been told', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.put(`*${PARTNER_AMENITIES_ENDPOINTS.list}/:id`, async () => {
        await held
        return HttpResponse.json({ success: true, data: { amenityId: 'a4', selected: true } })
      }),
    )

    const { result } = await renderLoaded()
    const target = find(result.current.amenities, 'Sea view')

    act(() => {
      result.current.toggle(target, true)
    })

    await waitFor(() => {
      expect(find(result.current.amenities, 'Sea view').selected).toBe(true)
    })
    // The handler has not run yet, so the server still holds the old value.
    expect(mockAmenitySelected(target.amenityId)).toBe(false)

    release()
  })

  /**
   * No success toast: over a toggle list that would mean six toasts for six
   * amenities. The switch position is the confirmation.
   */
  it('says nothing on success', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.toggle(find(result.current.amenities, 'Sea view'), true)
    })

    await waitFor(() => {
      expect(mockAmenitySelected('a4')).toBe(true)
    })
    expect(showSuccess).not.toHaveBeenCalled()
    expect(showErrorText).not.toHaveBeenCalled()
  })

  it('leaves the other rows untouched', async () => {
    const { result } = await renderLoaded()
    const before = result.current.amenities.filter((item) => item.selected).length

    act(() => {
      result.current.toggle(find(result.current.amenities, 'Sea view'), true)
    })

    await waitFor(() => {
      expect(result.current.amenities.filter((item) => item.selected)).toHaveLength(before + 1)
    })
  })

  /** One write per flip — no batching, no Save button (AC-01.4). */
  it('sends one request per flip', async () => {
    const requests = countRequests()
    const { result } = await renderLoaded()
    const afterLoad = requests().length

    act(() => {
      result.current.toggle(find(result.current.amenities, 'Sea view'), true)
    })
    await waitFor(() => {
      expect(requests()).toHaveLength(afterLoad + 1)
    })
    server.events.removeAllListeners()
  })

  /** Idempotent server-side, so a double-tap needs no client guard. */
  it('tolerates a double-tap and ends in the right state', async () => {
    const { result } = await renderLoaded()
    const target = find(result.current.amenities, 'Sea view')

    act(() => {
      result.current.toggle(target, true)
      result.current.toggle(target, true)
    })

    await waitFor(() => {
      expect(mockAmenitySelected(target.amenityId)).toBe(true)
    })
    expect(find(result.current.amenities, 'Sea view').selected).toBe(true)
  })
})

describe('useAmenitiesTab — rollback', () => {
  /**
   * A toggle left in the new position after a rejected write would misrepresent
   * saved state — the one thing a toggle must never do.
   */
  it('rolls back and reports when the write is refused', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)
    const target = find(result.current.amenities, 'Sea view')

    act(() => {
      result.current.toggle(target, true)
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(find(result.current.amenities, 'Sea view').selected).toBe(false)
  })

  it('rolls an un-assign back too', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    act(() => {
      result.current.toggle(find(result.current.amenities, 'Wi-Fi free'), false)
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    expect(find(result.current.amenities, 'Wi-Fi free').selected).toBe(true)
  })

  /**
   * The retired-amenity race: an admin can retire a catalogue amenity while the
   * tab is open. The row should disappear rather than revert, so the list is
   * re-read — the recovery the backend intends.
   */
  it('refetches when the amenity was retired, so the row disappears', async () => {
    const { result } = await renderLoaded()
    const target = find(result.current.amenities, 'Sea view')

    // Retired behind the partner's back, after the list loaded.
    retireMockAmenity(target.amenityId)

    act(() => {
      result.current.toggle(target, true)
    })

    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(result.current.amenities.some((item) => item.name === 'Sea view')).toBe(false)
    })
  })

  it('does not refetch on an ordinary refusal', async () => {
    const requests = countRequests()
    const { result } = await renderLoaded()
    setMockProfileStatus('PENDING')
    const afterLoad = requests().length

    act(() => {
      result.current.toggle(find(result.current.amenities, 'Sea view'), true)
    })
    await waitFor(() => {
      expect(showErrorText).toHaveBeenCalled()
    })

    // Only the PUT — a rollback needs no re-read.
    expect(requests()).toHaveLength(afterLoad + 1)
    server.events.removeAllListeners()
  })
})

describe('useAmenitiesTab — read-only (BR-07)', () => {
  it('passes the flag through so the switches can be disabled', async () => {
    setMockProfileStatus('PENDING')
    const { result } = await renderLoaded(false)

    expect(result.current.editable).toBe(false)
    // The list still renders; only writes are refused.
    expect(result.current.amenities.length).toBeGreaterThan(0)
  })
})

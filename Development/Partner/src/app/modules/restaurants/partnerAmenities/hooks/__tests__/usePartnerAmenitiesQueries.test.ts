import { describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import {
  mockAmenitySelected,
  resetMockAmenities,
} from '../../../../../../mocks/data/partnerAmenities'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import { PARTNER_AMENITIES_QUERY_KEY } from '../../constants'
import { useToggleAmenityMutation } from '../usePartnerAmenitiesQueries'

/** Renders the mutation alone, so the amenities cache starts genuinely empty. */
function renderToggle() {
  const queryClient = makeQueryClient()
  const view = renderHook(() => useToggleAmenityMutation(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

beforeEach(() => {
  resetMockProfile()
  resetMockAmenities()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

/**
 * The tab always loads the list before showing a switch, so an empty cache is not
 * reachable through the UI — but the optimistic write and its rollback both read
 * the cache, and neither may throw if it turns out to be missing (a flip racing a
 * cache eviction, or the mutation reused elsewhere later).
 */
describe('useToggleAmenityMutation — with no cached list', () => {
  it('writes nothing optimistically when there is nothing to write to', async () => {
    const { result, queryClient } = renderToggle()

    await waitFor(() => {
      expect(result.current.mutate).toBeTypeOf('function')
    })
    result.current.mutate({ amenityId: 'a4', selected: true })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    // No list was seeded, so none was invented — but the write still went through.
    expect(queryClient.getQueryData(PARTNER_AMENITIES_QUERY_KEY)).toBeUndefined()
    expect(mockAmenitySelected('a4')).toBe(true)
  })

  it('rolls nothing back when the write is refused', async () => {
    setMockProfileStatus('PENDING')
    const { result, queryClient } = renderToggle()

    result.current.mutate({ amenityId: 'a4', selected: true })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect(queryClient.getQueryData(PARTNER_AMENITIES_QUERY_KEY)).toBeUndefined()
    expect(mockAmenitySelected('a4')).toBe(false)
  })
})

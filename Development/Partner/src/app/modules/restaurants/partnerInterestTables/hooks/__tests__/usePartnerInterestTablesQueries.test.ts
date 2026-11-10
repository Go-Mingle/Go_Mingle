import { describe, it, expect, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { server } from '../../../../../../mocks/server'
import { HttpError } from '../../../../../../shared/api/httpClient'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import {
  resetMockProfile,
  setMockProfileStatus,
} from '../../../../../../mocks/data/partnerRestaurantProfile'
import { resetMockInterestTables } from '../../../../../../mocks/data/partnerInterestTables'
import {
  PARTNER_IT_ENDPOINTS,
  PARTNER_IT_QUERY_KEY,
  partnerBookingKey,
  partnerITBookingsKey,
  partnerITDetailKey,
  partnerITInviteesKey,
} from '../../constants'
import {
  useBookingQuery,
  useCancelBookingMutation,
  useCancelInviteMutation,
  useInterestTableBookingsQuery,
  useInterestTableInviteesQuery,
  useInterestTableMenuOptionsQuery,
  useInterestTableQuery,
  useInterestTablesQuery,
  useMinglerQuery,
} from '../usePartnerInterestTablesQueries'

function wrapperFor(queryClient = makeQueryClient()) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  }
}

beforeEach(() => {
  resetMockProfile()
  setMockProfileStatus('ACTIVE')
  resetMockInterestTables()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useInterestTablesQuery', () => {
  it('caches each params combination separately', async () => {
    const { queryClient, wrapper } = wrapperFor()
    const { result } = renderHook(() => useInterestTablesQuery({ page: 1, pageSize: 10 }), {
      wrapper,
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(
      queryClient.getQueryData([...PARTNER_IT_QUERY_KEY, { page: 1, pageSize: 10 }]),
    ).toBeDefined()
  })

  it('keeps previous results on screen while the next page loads', async () => {
    const { wrapper } = wrapperFor()
    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => useInterestTablesQuery({ page, pageSize: 2 }),
      { wrapper, initialProps: { page: 1 } },
    )

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    const firstPage = result.current.data?.items

    rerender({ page: 2 })

    // The point of placeholderData: the table never blanks mid-interaction.
    expect(result.current.data?.items).toEqual(firstPage)
    await waitFor(() => {
      expect(result.current.data?.items).not.toEqual(firstPage)
    })
  })

  it('does not fire without a session', () => {
    tokenStore.clear()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useInterestTablesQuery({}), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it('still loads while the profile is PENDING', async () => {
    setMockProfileStatus('PENDING')
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useInterestTablesQuery({}), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it('surfaces a load failure with its status intact', async () => {
    server.use(
      http.get(PARTNER_IT_ENDPOINTS.interestTables, () => HttpResponse.json({}, { status: 500 })),
    )
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useInterestTablesQuery({}), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('per-table reads', () => {
  const cases = [
    ['detail', useInterestTableQuery],
    ['menu options', useInterestTableMenuOptionsQuery],
    ['bookings', useInterestTableBookingsQuery],
    ['invitees', useInterestTableInviteesQuery],
  ] as const

  it.each(cases)('%s loads for a live table', async (_label, hook) => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => hook('it-1'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
  })

  it.each(cases)('%s stays idle without an id', (_label, hook) => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => hook(undefined), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })

  it.each(cases)('%s surfaces the 404 for a Draft table', async (_label, hook) => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => hook('it-draft'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).code).toBe('ERR_NOT_FOUND')
  })

  it.each(cases)('%s stays idle without a session', (_label, hook) => {
    tokenStore.clear()
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => hook('it-1'), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useBookingQuery', () => {
  it('fetches only once a row is selected', async () => {
    const { wrapper } = wrapperFor()
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useBookingQuery(id),
      { wrapper, initialProps: { id: null as string | null } },
    )

    expect(result.current.fetchStatus).toBe('idle')

    rerender({ id: 'bk-2' })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.topic).toBe('Wine & Dine')
  })
})

describe('useMinglerQuery', () => {
  it('loads a reachable Mingler', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useMinglerQuery('m-sana'), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.fullName).toBe('Sana Khan')
  })

  it('surfaces the 404 for an unreachable one without retrying it', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useMinglerQuery('m-unknown'), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(404)
  })

  it('stays idle with no id', () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useMinglerQuery(null), { wrapper })

    expect(result.current.fetchStatus).toBe('idle')
  })
})

describe('useCancelBookingMutation', () => {
  it('invalidates the whole interest-tables subtree, because seats move too', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData([...PARTNER_IT_QUERY_KEY, { page: 1 }], { items: [] })
    queryClient.setQueryData(partnerITDetailKey('it-1'), { interestTableId: 'it-1' })
    queryClient.setQueryData(partnerITBookingsKey('it-1'), { items: [] })

    const { result } = renderHook(() => useCancelBookingMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('bk-2')
    })

    expect(queryClient.getQueryState([...PARTNER_IT_QUERY_KEY, { page: 1 }])?.isInvalidated).toBe(
      true,
    )
    expect(queryClient.getQueryState(partnerITDetailKey('it-1'))?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(partnerITBookingsKey('it-1'))?.isInvalidated).toBe(true)
  })

  it('invalidates the open popup, whose status just changed', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData(partnerBookingKey('bk-2'), { bookingId: 'bk-2' })

    const { result } = renderHook(() => useCancelBookingMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('bk-2')
    })

    expect(queryClient.getQueryState(partnerBookingKey('bk-2'))?.isInvalidated).toBe(true)
  })

  it('surfaces the Promingler refusal with the shipped code', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useCancelBookingMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('bk-1').catch(() => undefined)
    })

    expect((result.current.error as HttpError).code).toBe('ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE')
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('surfaces the read-only refusal outside ACTIVE', async () => {
    setMockProfileStatus('PENDING')
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useCancelBookingMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync('bk-2').catch(() => undefined)
    })

    expect((result.current.error as HttpError).code).toBe('ERR_PROFILE_READ_ONLY')
  })

  it('does not invalidate when the cancel failed', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData([...PARTNER_IT_QUERY_KEY, { page: 1 }], { items: [] })

    const { result } = renderHook(() => useCancelBookingMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('bk-1').catch(() => undefined)
    })

    expect(
      queryClient.getQueryState([...PARTNER_IT_QUERY_KEY, { page: 1 }])?.isInvalidated,
    ).toBeFalsy()
  })
})

describe('useCancelInviteMutation', () => {
  it("invalidates one table's subtree, not the whole grid — no seats move", async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData(partnerITInviteesKey('it-1'), { inviteOnly: true, items: [] })
    queryClient.setQueryData([...PARTNER_IT_QUERY_KEY, { page: 1 }], { items: [] })

    const { result } = renderHook(() => useCancelInviteMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ itId: 'it-1', inviteeId: 'inv-1' })
    })

    expect(queryClient.getQueryState(partnerITInviteesKey('it-1'))?.isInvalidated).toBe(true)
    // The grid's own cached page is untouched — an invite is not a booking.
    expect(
      queryClient.getQueryState([...PARTNER_IT_QUERY_KEY, { page: 1 }])?.isInvalidated,
    ).toBeFalsy()
  })

  it('surfaces the not-cancellable refusal with its state', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useCancelInviteMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ itId: 'it-1', inviteeId: 'inv-2' }).catch(() => undefined)
    })

    const error = result.current.error as HttpError
    expect(error.code).toBe('ERR_INVITE_NOT_CANCELLABLE')
    expect(error.responseBody).toMatchObject({
      error: { details: { inviteStatus: 'TABLE_BOOKED' } },
    })
  })

  it('surfaces the read-only refusal outside ACTIVE', async () => {
    setMockProfileStatus('REJECTED')
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useCancelInviteMutation(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ itId: 'it-1', inviteeId: 'inv-1' }).catch(() => undefined)
    })

    expect((result.current.error as HttpError).code).toBe('ERR_PROFILE_READ_ONLY')
  })
})

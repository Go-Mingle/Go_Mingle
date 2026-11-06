import { describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import { resetMockPartnerUsers } from '../../../../../mocks/data/partnerUsers'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { HttpError } from '../../../../../shared/api/httpClient'
import { PARTNER_USERS_ENDPOINTS, PARTNER_USERS_QUERY_KEY } from '../../constants'
import type { PartnerUsersQueryParams } from '../../types'
import {
  useCreatePartnerUserMutation,
  useDeletePartnerUserMutation,
  usePartnerUsersQuery,
  useSetPartnerUserPasswordMutation,
  useUpdatePartnerUserMutation,
} from '../usePartnerUsersQuery'

const LIST = PARTNER_USERS_ENDPOINTS.list

function wrapperFor(queryClient = makeQueryClient()) {
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  }
}

function renderList(params: PartnerUsersQueryParams = {}) {
  const { queryClient, wrapper } = wrapperFor()
  return { ...renderHook(() => usePartnerUsersQuery(params), { wrapper }), queryClient }
}

beforeEach(() => {
  resetMockPartnerUsers()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('usePartnerUsersQuery', () => {
  it('loads the grid', async () => {
    const { result } = renderList()
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.items.map((u) => u.fullName)).toContain('Yasmeen Iqbal')
  })

  it('does not fire without a session', () => {
    tokenStore.clear()
    const { result } = renderList()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('keys the cache by params so paging does not clobber the previous page', async () => {
    const { queryClient, wrapper } = wrapperFor()
    const { result } = renderHook(() => usePartnerUsersQuery({ page: 2 }), { wrapper })
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(queryClient.getQueryData([...PARTNER_USERS_QUERY_KEY, { page: 2 }])).toBeDefined()
    expect(queryClient.getQueryData([...PARTNER_USERS_QUERY_KEY, { page: 1 }])).toBeUndefined()
  })

  it('surfaces a load failure', async () => {
    server.use(http.get(LIST, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderList()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('users mutations', () => {
  it('create invalidates every cached page', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData([...PARTNER_USERS_QUERY_KEY, { page: 1 }], { items: [] })

    const { result } = renderHook(() => useCreatePartnerUserMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        fullName: 'Nadia Rahman',
        email: 'nadia@aurelia.pk',
        password: 'Aurelia2026!',
        confirmPassword: 'Aurelia2026!',
      })
    })

    expect(
      queryClient.getQueryState([...PARTNER_USERS_QUERY_KEY, { page: 1 }])?.isInvalidated,
    ).toBe(true)
  })

  it('create surfaces a duplicate email to the caller', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useCreatePartnerUserMutation(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          fullName: 'Clash',
          email: 'yasmeen@aurelia.pk',
          password: 'Aurelia2026!',
          confirmPassword: 'Aurelia2026!',
        }),
      ).rejects.toBeInstanceOf(HttpError)
    })
    expect((result.current.error as HttpError).code).toBe('ERR_DUPLICATE_EMAIL')
  })

  it('update invalidates the grid', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData([...PARTNER_USERS_QUERY_KEY, { page: 1 }], { items: [] })

    const { result } = renderHook(() => useUpdatePartnerUserMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ id: 'pu-2', data: { fullName: 'Yasmeen I.' } })
    })

    expect(
      queryClient.getQueryState([...PARTNER_USERS_QUERY_KEY, { page: 1 }])?.isInvalidated,
    ).toBe(true)
  })

  it('update surfaces the primary guard without ending the session', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useUpdatePartnerUserMutation(), { wrapper })

    await act(async () => {
      await expect(
        result.current.mutateAsync({ id: 'pu-1', data: { status: 'SUSPENDED' } }),
      ).rejects.toBeInstanceOf(HttpError)
    })

    expect((result.current.error as HttpError).code).toBe('ERR_FORBIDDEN_PRIMARY')
    // The session must survive — a 403 here is about the target, not the caller.
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('set-password does not invalidate the grid — no listed field changes', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData([...PARTNER_USERS_QUERY_KEY, { page: 1 }], { items: [] })

    const { result } = renderHook(() => useSetPartnerUserPasswordMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({
        id: 'pu-2',
        data: { password: 'Aurelia2026!', confirmPassword: 'Aurelia2026!' },
      })
    })

    expect(
      queryClient.getQueryState([...PARTNER_USERS_QUERY_KEY, { page: 1 }])?.isInvalidated,
    ).toBe(false)
  })

  it('delete invalidates the grid', async () => {
    const { queryClient, wrapper } = wrapperFor()
    queryClient.setQueryData([...PARTNER_USERS_QUERY_KEY, { page: 1 }], { items: [] })

    const { result } = renderHook(() => useDeletePartnerUserMutation(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync('pu-2')
    })

    expect(
      queryClient.getQueryState([...PARTNER_USERS_QUERY_KEY, { page: 1 }])?.isInvalidated,
    ).toBe(true)
  })

  it('delete surfaces the primary guard', async () => {
    const { wrapper } = wrapperFor()
    const { result } = renderHook(() => useDeletePartnerUserMutation(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync('pu-1')).rejects.toBeInstanceOf(HttpError)
    })
    expect((result.current.error as HttpError).code).toBe('ERR_FORBIDDEN_PRIMARY')
  })
})

import { describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { server } from '../../../../../mocks/server'
import { accountResponses } from '../../../../../mocks/data/partnerAccount'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { HttpError } from '../../../../../shared/api/httpClient'
import { ACCOUNT_ENDPOINTS, PARTNER_ME_QUERY_KEY } from '../../constants'
import { usePartnerProfile, useUpdatePartnerProfileMutation } from '../usePartnerProfile'

function renderProfile(enabled = true) {
  const queryClient = makeQueryClient()
  const view = renderHook(() => usePartnerProfile(enabled), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('usePartnerProfile', () => {
  it('loads the profile', async () => {
    const { result } = renderProfile()

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.fullName).toBe('Hira Mansoor')
    expect(result.current.data?.designation).toBe('Owner')
  })

  it('does not fire while the modal is closed', () => {
    const { result } = renderProfile(false)
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('does not fire without a token', () => {
    tokenStore.clear()
    const { result } = renderProfile()
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('surfaces a load failure', async () => {
    server.use(http.get(ACCOUNT_ENDPOINTS.me, accountResponses.internal))
    const { result } = renderProfile()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('useUpdatePartnerProfileMutation', () => {
  it('writes the response into the cache without a follow-up GET', async () => {
    const queryClient = makeQueryClient()
    let getCalls = 0
    server.use(
      http.get(ACCOUNT_ENDPOINTS.me, () => {
        getCalls += 1
        return accountResponses.profile()
      }),
    )

    const { result } = renderHook(() => useUpdatePartnerProfileMutation(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    })

    await act(async () => {
      await result.current.mutateAsync({ fullName: 'Laiba Hashmi', designation: 'Owner' })
    })

    expect(queryClient.getQueryData(PARTNER_ME_QUERY_KEY)).toMatchObject({
      fullName: 'Laiba Hashmi',
    })
    expect(getCalls).toBe(0)
  })

  it('surfaces a validation failure to the caller', async () => {
    const queryClient = makeQueryClient()
    const { result } = renderHook(() => useUpdatePartnerProfileMutation(), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, children }),
    })

    await act(async () => {
      await expect(result.current.mutateAsync({ fullName: '' })).rejects.toBeInstanceOf(HttpError)
    })

    expect(result.current.isError).toBe(true)
  })
})

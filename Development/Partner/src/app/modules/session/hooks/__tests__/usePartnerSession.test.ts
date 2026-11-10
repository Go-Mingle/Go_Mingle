import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, waitFor } from '@testing-library/react'
import { http } from 'msw'
import { server } from '../../../../../mocks/server'
import { sessionResponses } from '../../../../../mocks/data/partnerSession'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { __clearSessionListeners } from '../../../../../shared/auth/sessionEvents'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { HttpError } from '../../../../../shared/api/httpClient'
import { SESSION_ENDPOINTS } from '../../constants'
import { usePartnerSession } from '../usePartnerSession'

function renderSession() {
  const queryClient = makeQueryClient()
  return renderHook(() => usePartnerSession(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'refresh-1', expiresAt: 1 })
})

afterEach(() => {
  __clearSessionListeners()
})

describe('usePartnerSession', () => {
  it('loads the session and exposes the route', async () => {
    server.use(http.get(SESSION_ENDPOINTS.session, () => sessionResponses.ok()))

    const { result } = renderSession()

    expect(result.current.isPending).toBe(true)
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })
    expect(result.current.data?.route).toBe('FULL_PORTAL')
    expect(result.current.data?.restaurant.coverImageUrl).toBeNull()
  })

  it('does not fire without an access token', () => {
    tokenStore.clear()

    const { result } = renderSession()

    expect(result.current.fetchStatus).toBe('idle')
    expect(result.current.data).toBeUndefined()
  })

  it('surfaces a 404 as a terminal error without retrying', async () => {
    let calls = 0
    server.use(
      http.get(SESSION_ENDPOINTS.session, () => {
        calls += 1
        return sessionResponses.notFound()
      }),
    )

    const { result } = renderSession()

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).code).toBe('ERR_NOT_FOUND')
    expect(calls).toBe(1)
  })

  it('retries a 503 with backoff and recovers when the backend returns', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let calls = 0
      server.use(
        http.get(SESSION_ENDPOINTS.session, () => {
          calls += 1
          return calls <= 2 ? sessionResponses.unavailable() : sessionResponses.ok()
        }),
      )

      const { result } = renderSession()

      await waitFor(() => {
        expect(calls).toBeGreaterThanOrEqual(1)
      })
      await vi.advanceTimersByTimeAsync(5000)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true)
      })
      expect(calls).toBe(3)
      expect(result.current.data?.route).toBe('FULL_PORTAL')
    } finally {
      vi.useRealTimers()
    }
  })

  it('gives up on a 503 that never clears, leaving the session intact', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let calls = 0
      server.use(
        http.get(SESSION_ENDPOINTS.session, () => {
          calls += 1
          return sessionResponses.unavailable()
        }),
      )

      const { result } = renderSession()

      await vi.advanceTimersByTimeAsync(20000)
      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })
      // The initial attempt plus three retries.
      expect(calls).toBe(4)
      expect(tokenStore.hasSession()).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

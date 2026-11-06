import { describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../mocks/server'
import { clearMockWebhookConfig, resetMockWebhooks } from '../../../../../mocks/data/webhooks'
import { AllProviders, makeQueryClient } from '../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { HttpError } from '../../../../../shared/api/httpClient'
import {
  WEBHOOK_CONFIG_QUERY_KEY,
  WEBHOOK_DELIVERIES_QUERY_KEY,
  WEBHOOK_ENDPOINTS,
} from '../../constants'
import type { DeliveryStatusFilter, WebhookConfig } from '../../types'
import { useWebhooks } from '../useWebhooks'

function renderWebhooks(page = 1, status: DeliveryStatusFilter = 'ALL') {
  const queryClient = makeQueryClient()
  const view = renderHook(() => useWebhooks(page, status), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
  return { ...view, queryClient }
}

beforeEach(() => {
  resetMockWebhooks()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useWebhooks queries', () => {
  it('loads the config and the first page of deliveries', async () => {
    const { result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.config).toBeDefined()
      expect(result.current.deliveriesPage).toBeDefined()
    })
    expect(result.current.config?.configured).toBe(true)
    expect(result.current.deliveriesPage?.items.length).toBeGreaterThan(0)
  })

  it('does not fire without a session', () => {
    tokenStore.clear()
    const { result } = renderWebhooks()
    expect(result.current.isPending).toBe(true)
    expect(result.current.deliveriesPage).toBeUndefined()
  })

  it('caches deliveries per page and filter', async () => {
    const { queryClient, result } = renderWebhooks(2, 'FAILED')
    await waitFor(() => {
      expect(result.current.deliveriesPage).toBeDefined()
    })
    expect(
      queryClient.getQueryData([...WEBHOOK_DELIVERIES_QUERY_KEY, { page: 2, status: 'FAILED' }]),
    ).toBeDefined()
    expect(
      queryClient.getQueryData([...WEBHOOK_DELIVERIES_QUERY_KEY, { page: 1, status: 'ALL' }]),
    ).toBeUndefined()
  })

  // MET-1274 — the literal is deliberate: pinning it to DELIVERIES_PAGE_SIZE
  // would follow the constant back down to 8 without ever failing.
  it('requests the documented page size of 25', async () => {
    let requested: string | null = null
    server.use(
      http.get(WEBHOOK_ENDPOINTS.deliveries, ({ request }) => {
        requested = new URL(request.url).searchParams.get('pageSize')
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )

    const { result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.deliveriesPage).toBeDefined()
    })
    expect(requested).toBe('25')
  })

  it('surfaces a config load failure', async () => {
    server.use(http.get(WEBHOOK_ENDPOINTS.config, () => HttpResponse.json({}, { status: 500 })))
    const { result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })
    expect((result.current.error as HttpError).status).toBe(500)
  })
})

describe('useWebhooks mutations', () => {
  const valid = {
    endpointUrl: 'https://api.aurelia-pos.com/hooks/gomingle',
    bearerToken: 'pos_live_token',
  }

  it('writes the saved config into the cache without a follow-up GET', async () => {
    let getCalls = 0
    server.use(
      http.get(WEBHOOK_ENDPOINTS.config, () => {
        getCalls += 1
        return HttpResponse.json({
          success: true,
          data: {
            endpointUrl: null,
            bearerTokenMasked: null,
            bearerToken: null,
            signingSecretMasked: null,
            signingSecret: null,
            enabled: false,
            configured: false,
            secretRotatedAt: null,
          },
        })
      }),
    )

    const { queryClient, result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.config).toBeDefined()
    })
    const callsAfterLoad = getCalls

    await act(async () => {
      await result.current.saveMutation.mutateAsync(valid)
    })

    expect(queryClient.getQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY)?.endpointUrl).toBe(
      valid.endpointUrl,
    )
    expect(getCalls).toBe(callsAfterLoad)
  })

  /** A full secret must never sit in the shared query cache. */
  it('strips the full secret and plaintext token before caching the save response', async () => {
    clearMockWebhookConfig()
    const { queryClient, result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.config).toBeDefined()
    })

    let returnedSecret: string | null = null
    await act(async () => {
      const saved = await result.current.saveMutation.mutateAsync(valid)
      returnedSecret = saved.signingSecret
    })

    // The caller still receives it, so the show-once modal can display it.
    expect(returnedSecret).toMatch(/^whsec_/)
    const cached = queryClient.getQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY)
    expect(cached?.signingSecret).toBeNull()
    expect(cached?.bearerToken).toBeNull()
  })

  it('patches only the secret fields after a rotation', async () => {
    const { queryClient, result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.config).toBeDefined()
    })
    const endpointBefore =
      queryClient.getQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY)?.endpointUrl

    await act(async () => {
      await result.current.rotateMutation.mutateAsync()
    })

    const cached = queryClient.getQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY)
    expect(cached?.endpointUrl).toBe(endpointBefore)
    expect(cached?.secretRotatedAt).toBeTruthy()
    expect(cached?.signingSecret).toBeNull()
  })

  /** The updater has to tolerate an empty cache — it patches, it does not create. */
  it('does not conjure a config from a rotation when nothing is cached', async () => {
    // The config never loaded, so there is nothing to patch.
    server.use(http.get(WEBHOOK_ENDPOINTS.config, () => HttpResponse.json({}, { status: 500 })))
    const { queryClient, result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    await act(async () => {
      await result.current.rotateMutation.mutateAsync()
    })

    // A config assembled from secret fields alone would have no endpoint or
    // `configured` flag, and would read as a working integration.
    expect(queryClient.getQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY)).toBeUndefined()
  })

  it('surfaces ERR_NOT_CONFIGURED from a rotation without ending the session', async () => {
    clearMockWebhookConfig()
    const { result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.config).toBeDefined()
    })

    let caught: unknown
    await act(async () => {
      caught = await result.current.rotateMutation.mutateAsync().catch((error: unknown) => error)
    })

    expect(caught).toBeInstanceOf(HttpError)
    expect((caught as HttpError).code).toBe('ERR_NOT_CONFIGURED')
    // A 409 precondition must never end the session the way a 403 suspension does.
    expect(tokenStore.hasSession()).toBe(true)
  })

  it('refetches the log after a test, because the outcome only lives there', async () => {
    let listCalls = 0
    server.use(
      http.get(WEBHOOK_ENDPOINTS.deliveries, () => {
        listCalls += 1
        return HttpResponse.json({
          success: true,
          data: { items: [], pagination: { page: 1, pageSize: 8, totalRecords: 0, totalPages: 1 } },
        })
      }),
    )

    const { result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.deliveriesPage).toBeDefined()
    })
    const callsBefore = listCalls

    await act(async () => {
      await result.current.testMutation.mutateAsync('BOOKING_CREATED')
    })

    // The query is mounted, so invalidation refetches immediately rather than
    // leaving an `isInvalidated` flag to observe.
    await waitFor(() => {
      expect(listCalls).toBeGreaterThan(callsBefore)
    })
  })

  it('reveals the plaintext bearer token without caching it', async () => {
    const { queryClient, result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.config).toBeDefined()
    })

    let revealed: string | null = null
    await act(async () => {
      revealed = await result.current.revealBearerToken()
    })

    expect(revealed).toBe('pos_live_a1b2c3d4e5f6g7h8i9j0')
    expect(
      queryClient.getQueryData<WebhookConfig>(WEBHOOK_CONFIG_QUERY_KEY)?.bearerToken,
    ).toBeNull()
  })

  it('refreshes the log on demand', async () => {
    const { queryClient, result } = renderWebhooks()
    await waitFor(() => {
      expect(result.current.deliveriesPage).toBeDefined()
    })

    await act(async () => {
      await result.current.refreshDeliveries()
    })

    expect(
      queryClient.getQueryState([...WEBHOOK_DELIVERIES_QUERY_KEY, { page: 1, status: 'ALL' }]),
    ).toBeDefined()
  })
})

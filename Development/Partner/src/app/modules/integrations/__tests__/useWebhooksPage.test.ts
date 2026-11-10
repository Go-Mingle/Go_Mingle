import { describe, it, expect, beforeEach } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { clearMockWebhookConfig, resetMockWebhooks } from '../../../../mocks/data/webhooks'
import { AllProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { WEBHOOK_ENDPOINTS } from '../constants'
import { useWebhooksPage } from '../hooks/useWebhooksPage'

function renderPage() {
  const queryClient = makeQueryClient()
  return renderHook(() => useWebhooksPage(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

async function renderLoaded() {
  const view = renderPage()
  await waitFor(() => {
    expect(view.result.current.config).toBeTruthy()
  })
  return view
}

beforeEach(() => {
  resetMockWebhooks()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('useWebhooksPage state', () => {
  it('derives its editable values from the loaded config', async () => {
    const { result } = await renderLoaded()
    expect(result.current.isPending).toBe(false)
    expect(result.current.endpointUrl).toContain('https://')
    expect(result.current.enabled).toBe(true)
    expect(result.current.canEnable).toBe(true)
  })

  it('shows the mask in the token field until it is revealed', async () => {
    const { result } = await renderLoaded()
    expect(result.current.tokenFieldValue).toBe('••••••••••••')
    expect(result.current.tokenRevealed).toBe(false)
  })

  it('locks the toggle and the test button while unconfigured (BR-06 / AC-05.3)', async () => {
    clearMockWebhookConfig()
    const { result } = await renderLoaded()
    expect(result.current.canEnable).toBe(false)
    expect(result.current.canTest).toBe(false)
  })

  it('allows a test while delivery is off (AC-05.2)', async () => {
    const { result } = await renderLoaded()
    await act(async () => {
      await result.current.saveSettings()
    })
    act(() => {
      result.current.requestToggle(false)
    })
    await act(async () => {
      await result.current.confirmToggle()
    })
    await waitFor(() => {
      expect(result.current.enabled).toBe(false)
    })
    expect(result.current.canTest).toBe(true)
  })

  it('tracks a local endpoint edit over the server value', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://new.example.com/hooks')
    })
    expect(result.current.endpointUrl).toBe('https://new.example.com/hooks')
  })
})

describe('useWebhooksPage reveal', () => {
  it('fetches the plaintext token for the eye icon', async () => {
    const { result } = await renderLoaded()
    await act(async () => {
      await result.current.onToggleToken?.()
    })
    expect(result.current.tokenFieldValue).toBe('pos_live_a1b2c3d4e5f6g7h8i9j0')
    expect(result.current.tokenRevealed).toBe(true)
  })

  /** MET-1276 — the reveal has to be reversible without a page reload. */
  it('puts the mask back when the control is toggled again', async () => {
    const { result } = await renderLoaded()
    await act(async () => {
      await result.current.onToggleToken?.()
    })
    expect(result.current.tokenRevealed).toBe(true)

    await act(async () => {
      await result.current.onToggleToken?.()
    })
    expect(result.current.tokenFieldValue).toBe('••••••••••••')
    expect(result.current.tokenRevealed).toBe(false)
    // Still offered, so the partner can reveal it again.
    expect(result.current.onToggleToken).toBeDefined()
  })

  it('withholds the control while the partner is typing their own token', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.onTokenChange('my-own-token')
    })
    // Nothing to unmask — hiding would only bin the edit.
    expect(result.current.onToggleToken).toBeUndefined()
    expect(result.current.tokenFieldValue).toBe('my-own-token')
  })

  it('offers no control before an endpoint and token are configured', async () => {
    clearMockWebhookConfig()
    const { result } = await renderLoaded()
    expect(result.current.onToggleToken).toBeUndefined()
  })

  it('hides without a request, and re-fetches rather than caching the plaintext', async () => {
    let reveals = 0
    server.use(
      http.get(WEBHOOK_ENDPOINTS.config, ({ request }) => {
        if (new URL(request.url).searchParams.get('reveal') === 'true') reveals += 1
        return HttpResponse.json({
          success: true,
          data: {
            endpointUrl: 'https://x.test/hook',
            bearerTokenMasked: '••••',
            bearerToken: 'plain_token',
            signingSecretMasked: 'whsec_••••1234',
            signingSecret: null,
            enabled: true,
            configured: true,
            secretRotatedAt: null,
          },
        })
      }),
    )

    const { result } = await renderLoaded()
    await act(async () => {
      await result.current.onToggleToken?.()
    })
    expect(reveals).toBe(1)

    // Hiding is a local reset — no request, and the plaintext is dropped.
    await act(async () => {
      await result.current.onToggleToken?.()
    })
    expect(reveals).toBe(1)
    expect(result.current.tokenFieldValue).toBe('••••')

    await act(async () => {
      await result.current.onToggleToken?.()
    })
    expect(reveals).toBe(2)
    expect(result.current.tokenFieldValue).toBe('plain_token')
  })

  it('reports a failed reveal instead of silently showing nothing', async () => {
    server.use(
      http.get(WEBHOOK_ENDPOINTS.config, ({ request }) => {
        if (new URL(request.url).searchParams.get('reveal') === 'true') {
          return HttpResponse.json({}, { status: 500 })
        }
        return HttpResponse.json({
          success: true,
          data: {
            endpointUrl: 'https://x.test/hook',
            bearerTokenMasked: '••••',
            bearerToken: null,
            signingSecretMasked: 'whsec_••••1234',
            signingSecret: null,
            enabled: true,
            configured: true,
            secretRotatedAt: null,
          },
        })
      }),
    )

    const { result } = await renderLoaded()
    await act(async () => {
      await result.current.onToggleToken?.()
    })
    // Still masked, and the failure did not leave the button spinning.
    expect(result.current.tokenRevealed).toBe(false)
    expect(result.current.revealing).toBe(false)
  })
})

describe('useWebhooksPage save', () => {
  it('omits `enabled` so an ordinary edit cannot mute a live integration', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return HttpResponse.json({
          success: true,
          data: {
            endpointUrl: body.endpointUrl,
            bearerTokenMasked: '••••',
            bearerToken: null,
            signingSecretMasked: 'whsec_••••1234',
            signingSecret: null,
            enabled: true,
            configured: true,
            secretRotatedAt: null,
          },
        })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://changed.example.com/hooks')
    })
    await act(async () => {
      await result.current.saveSettings()
    })

    expect(bodies).toHaveLength(1)
    expect('enabled' in bodies[0]).toBe(false)
  })

  /** The mask is not a credential — saving it would overwrite the real token. */
  it('resolves the plaintext token rather than saving the mask', async () => {
    let sentToken = ''
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) => {
        const body = (await request.json()) as { bearerToken: string }
        sentToken = body.bearerToken
        return HttpResponse.json({ success: true, data: { configured: true, enabled: true } })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://changed.example.com/hooks')
    })
    await act(async () => {
      await result.current.saveSettings()
    })

    expect(sentToken).toBe('pos_live_a1b2c3d4e5f6g7h8i9j0')
    expect(sentToken).not.toContain('•')
  })

  it('prefers a typed token over the stored one', async () => {
    let sentToken = ''
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) => {
        const body = (await request.json()) as { bearerToken: string }
        sentToken = body.bearerToken
        return HttpResponse.json({ success: true, data: { configured: true, enabled: true } })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.onTokenChange('typed_by_partner')
    })
    await act(async () => {
      await result.current.saveSettings()
    })
    expect(sentToken).toBe('typed_by_partner')
  })

  it('blocks a non-HTTPS endpoint before calling the API (BR-02)', async () => {
    let calls = 0
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, () => {
        calls += 1
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('http://insecure.example.com/hooks')
    })
    await act(async () => {
      await result.current.saveSettings()
    })

    expect(result.current.errors.endpoint).toBeTruthy()
    expect(calls).toBe(0)
    expect(result.current.tab).toBe('setup')
  })

  it('blocks a malformed endpoint', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('not-a-url')
    })
    await act(async () => {
      await result.current.saveSettings()
    })
    expect(result.current.errors.endpoint).toBeTruthy()
  })

  /** MET-1282 — https + under the length cap is not enough if the host cannot resolve. */
  it('blocks an https endpoint whose host has no TLD before calling the API', async () => {
    let calls = 0
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, () => {
        calls += 1
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://no-tld')
    })
    await act(async () => {
      await result.current.saveSettings()
    })

    expect(result.current.errors.endpoint).toBe(
      'Enter a full hostname, for example https://api.yourdomain.com/hooks.',
    )
    expect(calls).toBe(0)
  })

  it('accepts an https endpoint with a real host', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://hooks.example.com/gomingle')
    })
    await act(async () => {
      await result.current.saveSettings()
    })
    expect(result.current.errors.endpoint).toBeUndefined()
  })

  it('blocks an over-long endpoint', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange(`https://x.test/${'a'.repeat(2100)}`)
    })
    await act(async () => {
      await result.current.saveSettings()
    })
    expect(result.current.errors.endpoint).toBeTruthy()
  })

  it('blocks an empty bearer token (BR-03)', async () => {
    clearMockWebhookConfig()
    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://valid.example.com/hooks')
    })
    await act(async () => {
      await result.current.saveSettings()
    })
    expect(result.current.errors.token).toBeTruthy()
  })

  it('blocks an over-long bearer token', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.onTokenChange('t'.repeat(600))
    })
    await act(async () => {
      await result.current.saveSettings()
    })
    expect(result.current.errors.token).toBeTruthy()
  })

  it('shows the generated secret once on the first save (BR-04)', async () => {
    clearMockWebhookConfig()
    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://valid.example.com/hooks')
      result.current.onTokenChange('pos_live_first')
    })
    await act(async () => {
      await result.current.saveSettings()
    })

    await waitFor(() => {
      expect(result.current.revealedSecret).toMatch(/^whsec_/)
    })
    act(() => {
      result.current.clearSecret()
    })
    expect(result.current.revealedSecret).toBeNull()
  })

  it('surfaces a save failure as an error rather than a silent no-op', async () => {
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Save failed.' } },
          { status: 500 },
        ),
      ),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.onEndpointChange('https://valid.example.com/hooks')
    })
    await act(async () => {
      await result.current.saveSettings()
    })
    // The edit is kept so the partner can retry without retyping.
    expect(result.current.endpointUrl).toBe('https://valid.example.com/hooks')
  })
})

describe('useWebhooksPage toggle', () => {
  it('sends `enabled` only on an explicit toggle confirmation', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return HttpResponse.json({ success: true, data: { configured: true, enabled: false } })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.requestToggle(false)
    })
    expect(result.current.toggleTarget).toBe(false)

    await act(async () => {
      await result.current.confirmToggle()
    })
    expect(bodies[0]).toMatchObject({ enabled: false })
  })

  it('cancels without calling the API', async () => {
    let calls = 0
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, () => {
        calls += 1
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.requestToggle(true)
    })
    act(() => {
      result.current.cancelToggle()
    })
    await act(async () => {
      await result.current.confirmToggle()
    })
    expect(calls).toBe(0)
    expect(result.current.toggleTarget).toBeNull()
  })

  it('refuses to enable before an endpoint is saved (AC-03.2)', async () => {
    clearMockWebhookConfig()
    let calls = 0
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, () => {
        calls += 1
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    const { result } = await renderLoaded()
    act(() => {
      result.current.requestToggle(true)
    })
    await act(async () => {
      await result.current.confirmToggle()
    })
    expect(calls).toBe(0)
  })
})

describe('useWebhooksPage rotate and test', () => {
  it('rotates and shows the new secret once (BR-05)', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.openRotate()
    })
    expect(result.current.rotateOpen).toBe(true)

    await act(async () => {
      result.current.confirmRotate()
    })
    await waitFor(() => {
      expect(result.current.revealedSecret).toMatch(/^whsec_/)
    })
    expect(result.current.rotateOpen).toBe(false)
  })

  it('closes the rotate dialog without rotating', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.openRotate()
    })
    act(() => {
      result.current.closeRotate()
    })
    expect(result.current.rotateOpen).toBe(false)
    expect(result.current.revealedSecret).toBeNull()
  })

  it('reports a rotation failure without revealing anything', async () => {
    clearMockWebhookConfig()
    const { result } = await renderLoaded()
    await act(async () => {
      result.current.confirmRotate()
    })
    await waitFor(() => {
      expect(result.current.rotating).toBe(false)
    })
    expect(result.current.revealedSecret).toBeNull()
  })

  it('queues a test', async () => {
    const { result } = await renderLoaded()
    await act(async () => {
      result.current.sendTest('BOOKING_CREATED')
    })
    await waitFor(() => {
      expect(result.current.testSending).toBe(false)
    })
  })

  it('reports a test failure when nothing is configured', async () => {
    clearMockWebhookConfig()
    const { result } = await renderLoaded()
    await act(async () => {
      result.current.sendTest('BOOKING_CREATED')
    })
    await waitFor(() => {
      expect(result.current.testSending).toBe(false)
    })
  })
})

describe('useWebhooksPage deliveries', () => {
  it('loads the first page', async () => {
    const { result } = await renderLoaded()
    await waitFor(() => {
      expect(result.current.deliveries.length).toBeGreaterThan(0)
    })
    expect(result.current.totalDeliveries).toBeGreaterThan(0)
  })

  it('resets to page one when the filter changes', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.setPage(2)
    })
    expect(result.current.page).toBe(2)

    act(() => {
      result.current.changeStatusFilter('FAILED')
    })
    expect(result.current.statusFilter).toBe('FAILED')
    expect(result.current.page).toBe(1)
  })

  it('switches tabs', async () => {
    const { result } = await renderLoaded()
    act(() => {
      result.current.setTab('deliveries')
    })
    expect(result.current.tab).toBe('deliveries')
  })
})

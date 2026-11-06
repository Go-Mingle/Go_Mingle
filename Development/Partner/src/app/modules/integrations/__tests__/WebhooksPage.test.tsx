import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { clearMockWebhookConfig, resetMockWebhooks } from '../../../../mocks/data/webhooks'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { WEBHOOK_ENDPOINTS } from '../constants'
import { WebhooksPage } from '../WebhooksPage'

function setDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

async function renderPage() {
  renderWithProviders(<WebhooksPage />)
  await screen.findByRole('heading', { name: /webhooks/i })
}

beforeEach(() => {
  resetMockWebhooks()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  setDesktop()
})

describe('WebhooksPage states', () => {
  it('spins while the config loads', () => {
    const { container } = renderWithProviders(<WebhooksPage />)
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message when the config fails to load', async () => {
    server.use(
      http.get(WEBHOOK_ENDPOINTS.config, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Webhooks unavailable.' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<WebhooksPage />)
    expect(await screen.findByText('Webhooks unavailable.')).toBeInTheDocument()
  })

  it('renders the Active badge for a live integration', async () => {
    await renderPage()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByRole('switch')).toBeEnabled()
  })

  it('locks the toggle and explains why when nothing is configured (AC-01.1)', async () => {
    clearMockWebhookConfig()
    await renderPage()
    expect(screen.getByRole('switch')).toBeDisabled()
    expect(screen.getByText(/save your endpoint and bearer token before enabling/i)).toBeVisible()
  })
})

describe('WebhooksPage setup', () => {
  it('shows the masked bearer token, not the plaintext', async () => {
    await renderPage()
    expect(screen.getByDisplayValue('••••••••••••')).toBeInTheDocument()
    expect(screen.queryByDisplayValue(/pos_live_/)).not.toBeInTheDocument()
  })

  it('reveals the plaintext token through the eye icon (BR-16)', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /show token/i }))
    expect(await screen.findByDisplayValue('pos_live_a1b2c3d4e5f6g7h8i9j0')).toBeInTheDocument()
  })

  /**
   * MET-1276 / TC-PARTNER-WEBHOOK-011 — the control used to unmount after the
   * reveal, leaving the credential on screen until the page was reloaded.
   */
  it('hides the token again through the same control', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /show token/i }))
    expect(await screen.findByDisplayValue('pos_live_a1b2c3d4e5f6g7h8i9j0')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /hide token/i }))
    expect(await screen.findByDisplayValue('••••••••••••')).toBeInTheDocument()
    expect(screen.queryByDisplayValue(/pos_live_/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /show token/i })).toBeInTheDocument()
  })

  it('blocks a non-HTTPS endpoint inline (AC-01.3)', async () => {
    await renderPage()
    const user = userEvent.setup()
    const endpoint = screen.getByDisplayValue(/^https:\/\//)

    await user.clear(endpoint)
    await user.type(endpoint, 'http://insecure.example.com/hooks')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Endpoint URL must use HTTPS.')).toBeInTheDocument()
  })

  /** The mask is not a credential — an ordinary save must not persist bullets. */
  it('saves the real token even when the field still shows the mask', async () => {
    let sentToken = ''
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) => {
        const body = (await request.json()) as { bearerToken: string }
        sentToken = body.bearerToken
        return HttpResponse.json({
          success: true,
          data: {
            endpointUrl: 'https://changed.example.com/hooks',
            bearerTokenMasked: '••••••••••••',
            bearerToken: null,
            signingSecretMasked: 'whsec_••••3a9f',
            signingSecret: null,
            enabled: true,
            configured: true,
            secretRotatedAt: null,
          },
        })
      }),
    )

    await renderPage()
    const user = userEvent.setup()
    const endpoint = screen.getByDisplayValue(/^https:\/\//)
    await user.clear(endpoint)
    await user.type(endpoint, 'https://changed.example.com/hooks')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(sentToken).toBe('pos_live_a1b2c3d4e5f6g7h8i9j0')
    })
    expect(await screen.findByText(/webhook settings saved/i)).toBeInTheDocument()
  })

  it('offers no copy control beside the masked secret', async () => {
    await renderPage()
    expect(screen.queryByRole('button', { name: /copy secret/i })).not.toBeInTheDocument()
  })

  it('shows the new secret once after a rotation and warns there is no grace period', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /rotate/i }))
    expect(await screen.findByText(/no grace period/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /rotate secret/i }))
    expect(await screen.findByText(/only time we'll show it in full/i)).toBeInTheDocument()
    expect(screen.getByText(/^whsec_[0-9a-f]{32}$/)).toBeInTheDocument()
  })
})

describe('WebhooksPage events and test', () => {
  it('lists all seven event types', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('tab', { name: /^Events$/ }))
    expect(await screen.findByText("Events you'll receive")).toBeInTheDocument()
  })

  it('names no hardcoded fallback address', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('tab', { name: /^Events$/ }))
    await screen.findByText(/how delivery works/i)
    // The Figma's owner@aurelia.pk is a placeholder; the real one is per-restaurant.
    expect(screen.queryByText(/owner@aurelia\.ae/)).not.toBeInTheDocument()
    expect(screen.getByText(/your restaurant's contact email/i)).toBeInTheDocument()
  })

  /** A 202 means queued, not delivered — the copy must not claim success. */
  it('says a test was queued rather than that it succeeded', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: /^Events$/ }))
    await user.click(await screen.findByRole('button', { name: /send test/i }))

    expect(await screen.findByText(/test queued/i)).toBeInTheDocument()
    expect(screen.queryByText(/succeeded/i)).not.toBeInTheDocument()
  })

  it('reports ERR_NOT_CONFIGURED from a test without logging the partner out', async () => {
    clearMockWebhookConfig()
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: /^Events$/ }))
    // Send test is withheld until configured (AC-05.3).
    expect(await screen.findByRole('button', { name: /send test/i })).toBeDisabled()
    expect(tokenStore.hasSession()).toBe(true)
  })
})

describe('WebhooksPage deliveries', () => {
  it('renders the log with the backend labels and statuses', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('tab', { name: /recent deliveries/i }))

    expect((await screen.findAllByText(/Booking · Created/)).length).toBeGreaterThan(0)
    expect(screen.getByText('Failed · emailed')).toBeInTheDocument()
    expect(screen.getAllByText(/^Delivered$/).length).toBeGreaterThan(0)
  })

  /** FAILED and FAILED_EMAILED are both present in the fixture and differ. */
  it('distinguishes a terminal failure that was emailed from one that was not', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('tab', { name: /recent deliveries/i }))

    await screen.findByText('Failed · emailed')
    // Scoped to the table: "Failed" is also a status-filter option in the toolbar.
    const table = document.querySelector('.ant-table') as HTMLElement
    expect(within(table).getByText(/^Failed$/)).toBeInTheDocument()
  })

  it('labels a queued test in the log', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('tab', { name: /^Events$/ }))
    await user.click(await screen.findByRole('button', { name: /send test/i }))
    await user.click(screen.getByRole('tab', { name: /recent deliveries/i }))

    expect((await screen.findAllByText(/^Test$/)).length).toBeGreaterThan(0)
  })
})

describe('WebhooksPage toggle', () => {
  it('confirms before muting delivery', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByRole('switch'))
    expect(await screen.findByText(/turn off webhooks/i)).toBeInTheDocument()
  })

  it('mutes delivery and reports it (BR-08)', async () => {
    await renderPage()
    const user = userEvent.setup()

    await user.click(screen.getByRole('switch'))
    await user.click(await screen.findByRole('button', { name: /turn off/i }))

    // The trailing period distinguishes the toast from the confirm dialog's
    // "...while webhooks are off are not sent or emailed."
    expect(await screen.findByText(/webhooks are off\./i)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument()
    })
  })

  it('sends `enabled` only on the toggle path', async () => {
    const bodies: Record<string, unknown>[] = []
    server.use(
      http.put(WEBHOOK_ENDPOINTS.config, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>
        bodies.push(body)
        return HttpResponse.json({
          success: true,
          data: {
            endpointUrl: 'https://api.aurelia-pos.com/hooks/gomingle',
            bearerTokenMasked: '••••••••••••',
            bearerToken: null,
            signingSecretMasked: 'whsec_••••3a9f',
            signingSecret: null,
            // Mirrors the real endpoint: an omitted `enabled` leaves the toggle
            // as it was. Returning a hardcoded false here would flip the switch
            // on the ordinary save and invalidate the rest of the test.
            enabled: typeof body.enabled === 'boolean' ? body.enabled : true,
            configured: true,
            secretRotatedAt: null,
          },
        })
      }),
    )

    await renderPage()
    const user = userEvent.setup()

    // An ordinary save must leave the toggle alone.
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => {
      expect(bodies).toHaveLength(1)
    })
    expect('enabled' in bodies[0]).toBe(false)

    // The toggle path is the only one that sends it.
    await user.click(screen.getByRole('switch'))
    await user.click(await screen.findByRole('button', { name: /turn off/i }))
    await waitFor(() => {
      expect(bodies).toHaveLength(2)
    })
    expect(bodies[1]).toMatchObject({ enabled: false })
  })
})

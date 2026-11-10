import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { resetMockWebhooks } from '../../../../mocks/data/webhooks'
import {
  AllProviders,
  makeQueryClient,
  renderWithProviders,
} from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { WEBHOOK_ENDPOINTS } from '../constants'
import { useWebhooksPage } from '../hooks/useWebhooksPage'
import { WebhooksPage } from '../WebhooksPage'
import type { WebhookDelivery } from '../types'

/**
 * MET-1277 — `POST /partner/webhook/test` answers 202 and the delivery record is
 * written afterwards by the F2 worker. QA saw the 202, then an empty log for two
 * and a half minutes, with nothing on screen to say a test was in flight.
 *
 * These cover the whole path end to end: what the log shows during the gap, and
 * that the marker gives way to the server's real record when it lands.
 */

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

/**
 * Queries scoped to the log itself. Unscoped ones are ambiguous here: the status
 * filter offers "Delivered" as an option (MET-1275), the Events pane lists every
 * event name, and antd keeps visited panes mounted.
 */
function logTable() {
  const el = document.querySelector('.webhook-deliveries-table')
  if (!el) throw new Error('The deliveries table is not rendered.')
  return within(el as HTMLElement)
}

/**
 * Puts the deliveries endpoint under the test's control, so the worker's write
 * can be made to land on cue instead of on a timer.
 */
function stubDeliveries() {
  const state = { rows: [] as WebhookDelivery[] }
  server.use(
    http.get(WEBHOOK_ENDPOINTS.deliveries, () =>
      HttpResponse.json({
        success: true,
        data: {
          items: state.rows,
          pagination: { page: 1, pageSize: 8, totalRecords: state.rows.length, totalPages: 1 },
        },
      }),
    ),
  )
  return state
}

const recordedTest: WebhookDelivery = {
  eventType: 'BOOKING_CREATED',
  eventLabel: 'Booking · Created',
  tries: 1,
  reason: null,
  whenRelative: 'just now',
  occurredAt: new Date().toISOString(),
  status: 'DELIVERED',
  isTest: true,
}

beforeEach(() => {
  resetMockWebhooks()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  setDesktop()
})

async function renderPage() {
  renderWithProviders(<WebhooksPage />)
  await screen.findByRole('heading', { name: /webhooks/i })
}

async function sendTest(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /^Events$/ }))
  await user.click(await screen.findByRole('button', { name: /send test/i }))
  await screen.findByText(/test queued/i)
}

async function openLog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('tab', { name: /recent deliveries/i }))
}

describe('MET-1277 — a test send between accepted and recorded', () => {
  it('keeps saying the test is in flight after the toast has gone', async () => {
    stubDeliveries()
    await renderPage()
    const user = userEvent.setup()

    await sendTest(user)

    // The toast lasts three seconds; this does not.
    expect(
      await screen.findByText(/waiting for it to appear in recent deliveries/i),
    ).toBeInTheDocument()
  })

  /** The reported bug: 202, then an empty log with nothing to explain it. */
  it('shows a queued row in the log while the record does not exist yet', async () => {
    stubDeliveries()
    await renderPage()
    const user = userEvent.setup()

    await sendTest(user)
    await openLog(user)

    expect(await screen.findByText('Queued')).toBeInTheDocument()
    expect(logTable().getByText(/^Test$/)).toBeInTheDocument()
    expect(logTable().getByText('Booking · Created')).toBeInTheDocument()
    // Not the "no deliveries yet" dead end QA was left staring at.
    expect(screen.queryByText(/no deliveries yet/i)).not.toBeInTheDocument()
  })

  /** Neither delivered nor failed — the outcome is genuinely not known yet. */
  it('claims no attempt count for a row that has not been attempted', async () => {
    stubDeliveries()
    await renderPage()
    const user = userEvent.setup()

    await sendTest(user)
    await openLog(user)
    await screen.findByText('Queued')

    // Tries and Reason both read as unknown, rather than as 1 and "no failure".
    expect(logTable().getAllByText('—')).toHaveLength(2)
  })

  it('gives way to the server record once the worker writes it', async () => {
    const deliveries = stubDeliveries()
    await renderPage()
    const user = userEvent.setup()

    await sendTest(user)
    await openLog(user)
    await screen.findByText('Queued')

    // The worker catches up.
    deliveries.rows = [recordedTest]
    await user.click(screen.getByRole('button', { name: /refresh/i }))

    // The real row takes over, with the real status — and there is only one of it.
    await waitFor(() => {
      expect(screen.queryByText('Queued')).not.toBeInTheDocument()
    })
    expect(logTable().getByText('Delivered')).toBeInTheDocument()
    expect(logTable().getAllByText(/^Test$/)).toHaveLength(1)
  })

  it('does not treat an unrelated live delivery as the test landing', async () => {
    const deliveries = stubDeliveries()
    await renderPage()
    const user = userEvent.setup()

    await sendTest(user)
    await openLog(user)
    await screen.findByText('Queued')

    deliveries.rows = [{ ...recordedTest, isTest: false, whenRelative: '1m ago' }]
    await user.click(screen.getByRole('button', { name: /refresh/i }))

    await waitFor(() => {
      expect(logTable().getByText('Delivered')).toBeInTheDocument()
    })
    // Still outstanding — a live event is not the test we sent.
    expect(screen.getByText('Queued')).toBeInTheDocument()
  })
})

function renderController() {
  const queryClient = makeQueryClient()
  return renderHook(() => useWebhooksPage(), {
    wrapper: ({ children }: { children: ReactNode }) =>
      createElement(AllProviders, { queryClient, children }),
  })
}

async function loadedController() {
  const view = renderController()
  await waitFor(() => {
    expect(view.result.current.config).toBeTruthy()
  })
  return view
}

async function sendAndAwaitMarker(result: { current: ReturnType<typeof useWebhooksPage> }) {
  await act(async () => {
    result.current.sendTest('BOOKING_CREATED')
  })
  await waitFor(() => {
    expect(result.current.deliveries).toHaveLength(1)
  })
}

describe('MET-1277 — where the queued marker is allowed to appear', () => {
  it('counts the marker in the total so the pager and the page agree', async () => {
    stubDeliveries()
    const { result } = await loadedController()
    expect(result.current.totalDeliveries).toBe(0)

    await sendAndAwaitMarker(result)

    expect(result.current.totalDeliveries).toBe(1)
    expect(result.current.awaitingTestDelivery).toBe(true)
  })

  /** It has no server status, so under a status filter it would be a lie. */
  it('hides the marker under a status filter', async () => {
    stubDeliveries()
    const { result } = await loadedController()
    await sendAndAwaitMarker(result)

    act(() => {
      result.current.changeStatusFilter('FAILED')
    })
    await waitFor(() => {
      expect(result.current.deliveries).toHaveLength(0)
    })
    expect(result.current.totalDeliveries).toBe(0)
    // Hidden, not forgotten — the Events tab still says the test is in flight.
    expect(result.current.awaitingTestDelivery).toBe(true)
  })

  /** It is the newest row, so it has no business anywhere but the first page. */
  it('keeps the marker off later pages', async () => {
    stubDeliveries()
    const { result } = await loadedController()
    await sendAndAwaitMarker(result)

    act(() => {
      result.current.setPage(2)
    })
    await waitFor(() => {
      expect(result.current.deliveries).toHaveLength(0)
    })
  })

  it('does not hold a marker for a send the server rejected', async () => {
    stubDeliveries()
    server.use(
      http.post(WEBHOOK_ENDPOINTS.test, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_NOT_CONFIGURED', message: 'Not configured.' } },
          { status: 409 },
        ),
      ),
    )

    const { result } = await loadedController()
    await act(async () => {
      result.current.sendTest('BOOKING_CREATED')
    })
    await waitFor(() => {
      expect(result.current.testSending).toBe(false)
    })

    expect(result.current.awaitingTestDelivery).toBe(false)
    expect(result.current.deliveries).toHaveLength(0)
  })
})

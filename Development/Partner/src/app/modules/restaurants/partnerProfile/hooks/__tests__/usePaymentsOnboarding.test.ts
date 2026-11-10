import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactNode } from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../../../mocks/server'
import { resetMockProfile } from '../../../../../../mocks/data/partnerRestaurantProfile'
import { AllProviders, makeQueryClient } from '../../../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../../../shared/auth/tokenStore'
import {
  PARTNER_PROFILE_ENDPOINTS,
  PAYMENTS_CONFIRM_ATTEMPTS,
  PAYMENTS_CONFIRM_INTERVAL_MS,
} from '../../constants'
import { __resetPaymentsChannel } from '../../paymentsChannel'
import { usePaymentsOnboarding } from '../usePaymentsOnboarding'

/**
 * jsdom implements no BroadcastChannel, so this stands in: every instance sees
 * every post, which is what lets one "tab" observe another. Modelled on
 * `shared/auth/__tests__/crossTabSession.test.ts`.
 */
const channels: FakeChannel[] = []

class FakeChannel {
  listeners: ((event: MessageEvent<unknown>) => void)[] = []
  // A plain field, not a parameter property: those are not erasable syntax, which
  // `erasableSyntaxOnly` forbids.
  name: string
  constructor(name: string) {
    this.name = name
    channels.push(this)
  }
  postMessage(data: unknown) {
    for (const other of channels) {
      if (other === this) continue
      for (const listener of other.listeners) {
        listener({ data } as MessageEvent<unknown>)
      }
    }
  }
  addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
    this.listeners.push(listener)
  }
  removeEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) {
    this.listeners = this.listeners.filter((l) => l !== listener)
  }
  close() {}
}

const onReturned = vi.fn()
const onError = vi.fn()

const assign = vi.fn()
/** Safepay now gets its own tab; `assign` is only the popup-blocked fallback. */
const open = vi.fn(() => ({}) as Window)

/**
 * The location is returned alongside the hook because the return state is derived
 * from the URL rather than mirrored into state — the param *is* the assertion.
 */
function renderOnboarding(initialUrl = '/overview', paymentConfigured = false) {
  const queryClient = makeQueryClient()
  return renderHook(
    () => ({
      ...usePaymentsOnboarding({ onReturned, onError, paymentConfigured }),
      search: useLocation().search,
    }),
    {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(AllProviders, { queryClient, route: initialUrl, children }),
    },
  )
}

function linkResponds(url: string, mode = 'ONBOARDING') {
  server.use(
    http.post(`*${PARTNER_PROFILE_ENDPOINTS.onboardingLink}`, () =>
      HttpResponse.json({ success: true, data: { url, mode } }),
    ),
  )
}

beforeEach(() => {
  resetMockProfile()
  onReturned.mockClear()
  onError.mockClear()
  assign.mockClear()
  open.mockClear()
  open.mockReturnValue({} as Window)
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  vi.stubGlobal('location', { ...window.location, assign })
  vi.stubGlobal('open', open)
  channels.length = 0
  __resetPaymentsChannel()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('usePaymentsOnboarding launch', () => {
  /** AccountLinks are single-use and short-lived, so a link is minted per launch. */
  it('mints a link and opens Safepay in a new tab', async () => {
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/abc')
    const { result } = renderOnboarding()
    act(() => result.current.launch())

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith('https://sandbox.api.getsafepay.com/payouts/setup/abc', '_blank')
    })
    // The portal stays put in this tab.
    expect(assign).not.toHaveBeenCalled()
  })

  /**
   * Now a real signal. Previously the feature string carried `noopener`, which
   * makes `window.open` return null on **success** as well as on failure, so this
   * fallback fired on every launch and navigated the portal tab to Safepay. Without
   * the flag a null return genuinely means a popup blocker.
   */
  it('falls back to a same-tab navigation when the popup is blocked', async () => {
    open.mockReturnValue(null as unknown as Window)
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/blocked')
    const { result } = renderOnboarding()
    act(() => result.current.launch())

    await waitFor(() => {
      expect(assign).toHaveBeenCalledWith('https://sandbox.api.getsafepay.com/payouts/setup/blocked')
    })
  })

  /** The regression this replaced: a successful launch must leave this tab alone. */
  it('never navigates the launching tab when the popup opens', async () => {
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/abc')
    const { result } = renderOnboarding()
    act(() => result.current.launch())

    await waitFor(() => {
      expect(open).toHaveBeenCalled()
    })
    expect(assign).not.toHaveBeenCalled()
  })

  /**
   * `mode` is deliberately **not** surfaced. It only arrives on the response that
   * immediately redirects to Safepay, so it can never title the modal the partner
   * is already looking at — the modal reads `paymentConfigured` instead, which is
   * the same fact the server branches on.
   */
  it('does not surface the response mode', async () => {
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/abc', 'UPDATE')
    const { result } = renderOnboarding()
    act(() => result.current.launch())

    await waitFor(() => {
      expect(open).toHaveBeenCalled()
    })
    expect(result.current).not.toHaveProperty('mode')
  })

  it('reports a failure to mint rather than navigating anywhere', async () => {
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.onboardingLink}`, () =>
        HttpResponse.json(
          { error: { code: 'ERR_PAYMENT_SEAM', message: 'Safepay unavailable.' } },
          { status: 503 },
        ),
      ),
    )
    const { result } = renderOnboarding()
    act(() => result.current.launch())

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    expect(open).not.toHaveBeenCalled()
    expect(assign).not.toHaveBeenCalled()
  })

  /**
   * MET-1254. A caller with a dialog open has to be able to keep it open, so the
   * outcome is handed back rather than only toasted.
   */
  it('tells the caller once Safepay has the partner', async () => {
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/abc')
    const onLaunched = vi.fn()
    const onFailed = vi.fn()
    const { result } = renderOnboarding()
    act(() => result.current.launch({ onLaunched, onFailed }))

    await waitFor(() => {
      expect(onLaunched).toHaveBeenCalled()
    })
    expect(onFailed).not.toHaveBeenCalled()
  })

  /** The popup-blocked tab is still a hand-off: Safepay gets it, just in place. */
  it('reports a same-tab fallback as launched too', async () => {
    open.mockReturnValue(null as unknown as Window)
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/blocked')
    const onLaunched = vi.fn()
    const { result } = renderOnboarding()
    act(() => result.current.launch({ onLaunched }))

    await waitFor(() => {
      expect(onLaunched).toHaveBeenCalled()
    })
    expect(assign).toHaveBeenCalled()
  })

  it('hands a failed mint to the caller instead of the toast', async () => {
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.onboardingLink}`, () =>
        HttpResponse.json({}, { status: 502 }),
      ),
    )
    const onLaunched = vi.fn()
    const onFailed = vi.fn()
    const { result } = renderOnboarding()
    act(() => result.current.launch({ onLaunched, onFailed }))

    await waitFor(() => {
      expect(onFailed).toHaveBeenCalled()
    })
    expect(onLaunched).not.toHaveBeenCalled()
    // The caller owns the message now, so the toast channel stays quiet.
    expect(onError).not.toHaveBeenCalled()
  })

  /** A caller that only wants the success signal still gets the toast on failure. */
  it('falls back to the toast when the caller handles only the launch', async () => {
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.onboardingLink}`, () =>
        HttpResponse.json({}, { status: 502 }),
      ),
    )
    const onLaunched = vi.fn()
    const { result } = renderOnboarding()
    act(() => result.current.launch({ onLaunched }))

    await waitFor(() => {
      expect(onError).toHaveBeenCalled()
    })
    expect(onLaunched).not.toHaveBeenCalled()
  })

  /** The button needs a busy state; the response is held open to observe it. */
  it('reports while the link is being minted', async () => {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.post(`*${PARTNER_PROFILE_ENDPOINTS.onboardingLink}`, async () => {
        await held
        return HttpResponse.json({ success: true, data: { url: 'https://x', mode: 'ONBOARDING' } })
      }),
    )

    const { result } = renderOnboarding()
    expect(result.current.launching).toBe(false)
    act(() => result.current.launch())
    await waitFor(() => {
      expect(result.current.launching).toBe(true)
    })

    release()
    await waitFor(() => {
      expect(result.current.launching).toBe(false)
    })
  })
})

describe('usePaymentsOnboarding return state', () => {
  it('is idle with no param', () => {
    const { result } = renderOnboarding()
    expect(result.current.returnState).toBe('none')
    expect(onReturned).not.toHaveBeenCalled()
  })

  /**
   * Returning does not itself mark payments configured — that waits on Safepay's
   * `account.updated` webhook — so the profile is re-read.
   */
  /**
   * The other half of the new-tab hand-off. Safepay's return URL loads in the tab
   * it opened, so the portal tab never sees `?payments=return` — it has to hear
   * about the return over the channel instead.
   */
  it('tells the other tabs it was handed back', async () => {
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    __resetPaymentsChannel()
    const heard = vi.fn()
    // Stand in for the portal tab, subscribed before the return happens.
    const listener = new FakeChannel('gomingle-partner-payments')
    listener.addEventListener('message', heard)

    renderOnboarding('/overview?payments=return')

    await waitFor(() => {
      expect(heard).toHaveBeenCalledWith(
        expect.objectContaining({ data: { type: 'payments-returned' } }),
      )
    })
  })

  /** Only a tab we opened closes itself; the popup-blocked tab is the only one. */
  it('closes itself only when it was opened by script', async () => {
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    const close = vi.fn()
    vi.stubGlobal('close', close)

    vi.stubGlobal('opener', null)
    renderOnboarding('/overview?payments=return')
    await waitFor(() => {
      expect(onReturned).toHaveBeenCalled()
    })
    expect(close).not.toHaveBeenCalled()

    onReturned.mockClear()
    vi.stubGlobal('opener', {})
    __resetPaymentsChannel()
    renderOnboarding('/overview?payments=return')
    await waitFor(() => {
      expect(close).toHaveBeenCalled()
    })
  })

  it('re-reads the profile when another tab reports the return', async () => {
    vi.stubGlobal('BroadcastChannel', FakeChannel)
    __resetPaymentsChannel()
    const { result } = renderOnboarding('/overview')

    // The tab Safepay landed in, announcing itself. Wrapped in `act` because the
    // listener sets state, and asserted through `waitFor` so the flush is awaited
    // rather than assumed — it is a listener, not a rendered event.
    await act(async () => {
      new FakeChannel('gomingle-partner-payments').postMessage({ type: 'payments-returned' })
    })

    await waitFor(() => {
      expect(onReturned).toHaveBeenCalled()
      expect(result.current.returnState).toBe('returned')
    })
  })

  /** No BroadcastChannel — older browsers, and jsdom by default. */
  it('still handles its own return when the channel is unavailable', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    __resetPaymentsChannel()

    renderOnboarding('/overview?payments=return')

    await waitFor(() => {
      expect(onReturned).toHaveBeenCalled()
    })
  })

  it('re-reads the profile on return', async () => {
    const { result } = renderOnboarding('/overview?payments=return')
    await waitFor(() => {
      expect(onReturned).toHaveBeenCalledTimes(1)
    })
    expect(result.current.returnState).toBe('returned')
    expect(open).not.toHaveBeenCalled()
  })

  /** `refresh` is routine, not an error: the link expired, so mint another. */
  it('self-heals a refresh by minting a new link', async () => {
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/second')
    renderOnboarding('/overview?payments=refresh')

    await waitFor(() => {
      expect(open).toHaveBeenCalledWith('https://sandbox.api.getsafepay.com/payouts/setup/second', '_blank')
    })
    expect(onReturned).not.toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('ignores a param value it does not recognise', () => {
    const { result } = renderOnboarding('/overview?payments=banana')
    expect(result.current.returnState).toBe('none')
    expect(onReturned).not.toHaveBeenCalled()
    expect(open).not.toHaveBeenCalled()
  })

  it('leaves other query params alone when dismissing', async () => {
    const { result } = renderOnboarding('/overview?payments=return&tab=contacts')
    await waitFor(() => {
      expect(result.current.returnState).toBe('returned')
    })
    act(() => result.current.dismissReturnState())
    await waitFor(() => {
      expect(result.current.returnState).toBe('none')
    })
    expect(result.current.search).not.toContain('payments')
    expect(result.current.search).toContain('tab=contacts')
  })

  /** Safepay can re-render this on mount; the return must be acted on once. */
  it('acts on a param once even across re-renders', async () => {
    const { result, rerender } = renderOnboarding('/overview?payments=return')
    await waitFor(() => {
      expect(onReturned).toHaveBeenCalledTimes(1)
    })
    rerender()
    rerender()
    expect(onReturned).toHaveBeenCalledTimes(1)
    expect(result.current.returnState).toBe('returned')
  })
})

/**
 * `paymentConfigured` only flips when Safepay's `account.updated` webhook lands,
 * which can lag by seconds to minutes — or never, if verification is incomplete.
 * So a return polls for a bounded while and always offers a manual re-check.
 */
describe('usePaymentsOnboarding confirmation poll', () => {
  /**
   * The load-bearing half of the new-tab hand-off. Safepay's return URL loads in
   * the tab it opened, so *this* tab never sees `?payments=return` — without a
   * poll keyed on having launched, the partner would sit here watching nothing.
   */
  it('polls in the launching tab, which never sees the return param', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/abc')
      const { result } = renderOnboarding('/overview', false)

      await act(async () => {
        result.current.launch()
      })
      await waitFor(() => {
        expect(open).toHaveBeenCalled()
      })
      // No return param here — the launch alone arms the poll and surfaces the
      // "still verifying" notice, so this tab is not left showing nothing.
      expect(result.current.returnState).toBe('returned')

      const before = onReturned.mock.calls.length
      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS)
      })
      expect(onReturned.mock.calls.length).toBeGreaterThan(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('says nothing before anything has been launched', async () => {
    const { result } = renderOnboarding('/overview', false)
    expect(result.current.returnState).toBe('none')
  })

  /** Once the webhook lands there is nothing left to verify. */
  it('retires the verifying notice once payment is confirmed', async () => {
    linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/abc')
    const { result } = renderOnboarding('/overview', true)

    await act(async () => {
      result.current.launch()
    })
    await waitFor(() => {
      expect(open).toHaveBeenCalled()
    })

    expect(result.current.returnState).toBe('none')
  })

  it('does not poll before anything has been launched', async () => {
    vi.useFakeTimers()
    try {
      renderOnboarding('/overview', false)

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS * 3)
      })
      expect(onReturned).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  /** A popup-blocked launch navigates this tab away, so there is nothing to poll. */
  it('does not poll a launch that already has payments confirmed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      linkResponds('https://sandbox.api.getsafepay.com/payouts/setup/abc')
      const { result } = renderOnboarding('/overview', true)

      await act(async () => {
        result.current.launch()
      })
      await waitFor(() => {
        expect(open).toHaveBeenCalled()
      })

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS * 3)
      })
      expect(onReturned).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('re-reads on an interval while payment is still unconfirmed', async () => {
    vi.useFakeTimers()
    try {
      renderOnboarding('/overview?payments=return', false)
      // The immediate read on arrival.
      expect(onReturned).toHaveBeenCalledTimes(1)

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS)
      })
      expect(onReturned).toHaveBeenCalledTimes(2)

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS)
      })
      expect(onReturned).toHaveBeenCalledTimes(3)
    } finally {
      vi.useRealTimers()
    }
  })

  /** Bounded: an incomplete verification may never confirm, and a timer left
      running would poll for as long as the page stays open. */
  it('gives up after its cap rather than polling forever', async () => {
    vi.useFakeTimers()
    try {
      renderOnboarding('/overview?payments=return', false)

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS * (PAYMENTS_CONFIRM_ATTEMPTS + 5))
      })

      // One arrival read plus exactly the capped number of polls.
      expect(onReturned).toHaveBeenCalledTimes(PAYMENTS_CONFIRM_ATTEMPTS + 1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not poll once payment is confirmed', async () => {
    vi.useFakeTimers()
    try {
      renderOnboarding('/overview?payments=return', true)
      expect(onReturned).toHaveBeenCalledTimes(1)

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS * 3)
      })

      expect(onReturned).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not poll when the partner never came back from Safepay', async () => {
    vi.useFakeTimers()
    try {
      renderOnboarding('/overview', false)

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS * 3)
      })

      expect(onReturned).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  /** The escape hatch for when the poll has given up. */
  it('re-reads on demand', async () => {
    const { result } = renderOnboarding('/overview?payments=return', false)
    await waitFor(() => {
      expect(onReturned).toHaveBeenCalled()
    })
    const before = onReturned.mock.calls.length

    act(() => result.current.checkAgain())

    expect(onReturned.mock.calls.length).toBeGreaterThan(before)
    expect(result.current.checking).toBe(true)
  })

  /** The busy flag is a spinner window, not a request state — it must clear. */
  it('stops reporting as checking once the window closes', async () => {
    vi.useFakeTimers()
    try {
      const { result } = renderOnboarding('/overview?payments=return', true)
      act(() => result.current.checkAgain())
      expect(result.current.checking).toBe(true)

      await act(async () => {
        vi.advanceTimersByTime(PAYMENTS_CONFIRM_INTERVAL_MS)
      })

      expect(result.current.checking).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })
})

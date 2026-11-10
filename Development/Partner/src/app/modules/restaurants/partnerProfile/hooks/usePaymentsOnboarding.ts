import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  PAYMENTS_CONFIRM_ATTEMPTS,
  PAYMENTS_CONFIRM_INTERVAL_MS,
  PAYMENTS_QUERY_PARAM,
} from '../constants'
import { broadcastPaymentsReturned, onPaymentsReturned } from '../paymentsChannel'
import { useOnboardingLinkMutation } from './usePartnerProfileQueries'

/** What Safepay told us on the way back, via `?payments=`. */
export type PaymentsReturnState = 'none' | 'returned' | 'refreshing'

interface UsePaymentsOnboardingOptions {
  /** Re-read the profile after a return — `paymentConfigured` may have changed. */
  onReturned: () => void
  onError: (error: unknown) => void
  /** True once the webhook has landed; stops the confirmation poll. */
  paymentConfigured: boolean
}

/**
 * How one launch reports back to whoever asked for it.
 *
 * Both are optional because the two callers want different things: the dialog
 * closes only once Safepay has actually been handed the partner and shows the
 * reason inline otherwise, while the `?payments=refresh` self-heal fires with no
 * dialog on screen and falls back to {@link UsePaymentsOnboardingOptions.onError}.
 */
export interface LaunchHandlers {
  /** Safepay has the partner — a tab opened, or this one is navigating. */
  onLaunched?: () => void
  /** No link was minted, so nothing was handed off. */
  onFailed?: (error: unknown) => void
}

/**
 * Drives the Safepay hand-off.
 *
 * Two things about the contract shape this:
 *
 * 1. AccountLinks are single-use and short-lived, so a link is minted per launch
 *    and never cached. `?payments=refresh` is Safepay telling us the link expired
 *    or was reopened — it is **not** an error page, it fires routinely, and the
 *    correct response is to mint a new link and redirect again.
 * 2. Returning from Safepay does not itself mark payments configured. That only
 *    happens when Safepay's `account.updated` webhook lands, which can lag by a
 *    moment — so a return with `paymentConfigured` still false is "verifying",
 *    never "failed".
 *
 * The return state is *derived from the URL* rather than mirrored into React
 * state: the query param is already the source of truth, and copying it into
 * state would mean setting state from an effect for no gain.
 */
export function usePaymentsOnboarding({
  onReturned,
  onError,
  paymentConfigured,
}: UsePaymentsOnboardingOptions) {
  const [searchParams, setSearchParams] = useSearchParams()
  const onboardingLink = useOnboardingLinkMutation()
  // Safepay can re-render this on mount; each param must be acted on once.
  const handledRef = useRef<string | null>(null)
  const [checking, setChecking] = useState(false)
  /**
   * True once Safepay has been handed a new tab. The return URL lands *there*, so
   * this tab would otherwise never learn the onboarding happened — it polls on
   * having launched rather than on `?payments=return`.
   */
  const [launched, setLaunched] = useState(false)

  const paymentsParam = searchParams.get(PAYMENTS_QUERY_PARAM)

  const clearPaymentsParam = useCallback(() => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.delete(PAYMENTS_QUERY_PARAM)
        return next
      },
      { replace: true },
    )
  }, [setSearchParams])

  /**
   * Mints a fresh link and hands Safepay a new tab, so the partner keeps the
   * portal open behind it.
   *
   * **No `noopener` in the feature string, deliberately.** Per the HTML spec
   * `window.open` returns null whenever `noopener` is set — on success, not only
   * on failure — so a null check against it navigated this tab to Safepay every
   * single time. Without the flag the handle is real, `!opened` genuinely means a
   * popup blocker, and the same-tab fallback is honest. The lost reverse-tabnabbing
   * protection is acceptable for Safepay, and the return is coordinated over a
   * BroadcastChannel rather than `window.opener`.
   *
   * The outcome is reported back rather than swallowed (MET-1254). Minting can
   * fail — a 502 from the onboarding endpoint is what QA hit — and the caller is
   * the only one that knows where the partner is looking when it does.
   */
  const launch = useCallback(
    (handlers?: LaunchHandlers) => {
      onboardingLink.mutate(undefined, {
        onSuccess: ({ url }) => {
          const opened = window.open(url, '_blank')
          if (opened) setLaunched(true)
          else window.location.assign(url)
          handlers?.onLaunched?.()
        },
        onError: (cause) => {
          // A caller with a dialog open owns the message; without one — the
          // refresh self-heal — the toast is the only channel there is.
          if (handlers?.onFailed) handlers.onFailed(cause)
          else onError(cause)
        },
      })
    },
    [onboardingLink, onError],
  )

  useEffect(() => {
    if (!paymentsParam || handledRef.current === paymentsParam) return
    handledRef.current = paymentsParam

    if (paymentsParam === 'refresh') {
      // The expired-link path: self-heal by minting another and going back.
      clearPaymentsParam()
      launch()
      return
    }
    if (paymentsParam === 'return') {
      onReturned()
      // Safepay landed in the tab it opened, so the tab the partner started from
      // has to be told.
      broadcastPaymentsReturned()
      // Only a tab we opened closes itself. `window.opener` is the discriminator:
      // it is set on the tab `launch` spawned and null on the popup-blocked path,
      // where this *is* the partner's only tab and closing it would strand them.
      if (window.opener) window.close()
    }
    // launch/onReturned identity changes must not re-trigger a redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsParam])

  /**
   * The other half of the hand-off: this tab never sees `?payments=return`, so it
   * learns of the return from the tab that did.
   */
  useEffect(
    () =>
      onPaymentsReturned(() => {
        setLaunched(true)
        onReturned()
      }),
    [onReturned],
  )

  /**
   * Confirmation poll.
   *
   * `paymentConfigured` only flips when Safepay's webhook lands, which can lag by
   * seconds to minutes — so a return is followed by a few re-reads rather than
   * leaving the partner to reload.
   *
   * Bounded on purpose: an incomplete verification may never confirm, and an
   * unbounded timer would then poll this page for as long as it stays open.
   */
  useEffect(() => {
    if ((paymentsParam !== 'return' && !launched) || paymentConfigured) return

    let attempts = 0
    const timer = setInterval(() => {
      attempts += 1
      onReturned()
      if (attempts >= PAYMENTS_CONFIRM_ATTEMPTS) clearInterval(timer)
    }, PAYMENTS_CONFIRM_INTERVAL_MS)

    return () => {
      clearInterval(timer)
    }
    // onReturned identity changes must not restart the poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentsParam, paymentConfigured, launched])

  /** The manual escape hatch, for when the poll has given up. */
  const checkAgain = useCallback(() => {
    setChecking(true)
    onReturned()
    // Purely a spinner window: the caller's refetch resolves on its own schedule
    // and the notice is driven by `paymentConfigured`, not by this flag.
    setTimeout(() => setChecking(false), PAYMENTS_CONFIRM_INTERVAL_MS)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const RETURN_STATES: Record<string, PaymentsReturnState> = {
    return: 'returned',
    refresh: 'refreshing',
  }
  const derived: PaymentsReturnState = RETURN_STATES[paymentsParam ?? ''] ?? 'none'
  /**
   * A launch in this tab reads as "returned" too, even though Safepay's own return
   * lands in the tab it opened. Without this the launching tab would poll in
   * silence — no "still verifying" notice, nothing to show the partner that
   * anything is pending. `paymentConfigured` retires it.
   */
  const returnState: PaymentsReturnState =
    derived === 'none' && launched && !paymentConfigured ? 'returned' : derived

  return {
    launch,
    launching: onboardingLink.isPending,
    returnState,
    checkAgain,
    checking,
    // Dismissing the notice clears the param, which is what drives the state.
    dismissReturnState: clearPaymentsParam,
  }
}

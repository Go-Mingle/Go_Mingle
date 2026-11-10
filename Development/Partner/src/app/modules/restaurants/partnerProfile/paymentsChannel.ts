/**
 * Cross-tab coordination for the Safepay onboarding hand-off.
 *
 * Safepay is opened in a new tab, and its return URL loads in *that* tab — so the
 * tab the partner started from never sees `?payments=return` and would otherwise
 * sit there learning nothing. The returning tab announces itself here and closes;
 * the original tab is listening, re-reads the profile, and shows the verifying
 * notice.
 *
 * Both tabs are same-origin (Safepay returns to our own `/overview`), so a
 * `BroadcastChannel` is enough and no `window.opener` relationship is needed.
 *
 * Feature-detected, like `shared/auth/crossTabSession`: where the API is missing
 * — older browsers, and jsdom, which does not implement it — this degrades to the
 * single-tab behaviour, which is correct for a single tab and no worse than
 * before. Messages carry a reason and **never** a token.
 */

const CHANNEL_NAME = 'gomingle-partner-payments'

interface PaymentsReturnedMessage {
  type: 'payments-returned'
}

function createChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null
  try {
    return new BroadcastChannel(CHANNEL_NAME)
  } catch {
    // Some privacy modes expose the constructor but refuse to construct it.
    return null
  }
}

let channel: BroadcastChannel | null | undefined

/** Lazy so a tab that never reaches payments never opens a channel. */
function getChannel(): BroadcastChannel | null {
  channel ??= createChannel()
  return channel
}

/** Tells the other tabs that Safepay handed this one back. */
export function broadcastPaymentsReturned(): void {
  const message: PaymentsReturnedMessage = { type: 'payments-returned' }
  try {
    getChannel()?.postMessage(message)
  } catch {
    // An unavailable channel must never break the local return handling, which
    // is what the partner in *this* tab sees.
  }
}

function isPaymentsReturnedMessage(data: unknown): data is PaymentsReturnedMessage {
  return (data as PaymentsReturnedMessage | null)?.type === 'payments-returned'
}

/**
 * Subscribes to returns announced by *other* tabs. Returns the unsubscribe
 * function, for use as an effect cleanup.
 */
export function onPaymentsReturned(listener: () => void): () => void {
  const active = getChannel()
  if (!active) return () => {}

  const handler = (event: MessageEvent<unknown>) => {
    if (isPaymentsReturnedMessage(event.data)) listener()
  }
  active.addEventListener('message', handler)
  return () => {
    active.removeEventListener('message', handler)
  }
}

/** Test-only — the channel is module state that outlives a test file. */
export function __resetPaymentsChannel(): void {
  try {
    channel?.close()
  } catch {
    /* already closed */
  }
  channel = undefined
}

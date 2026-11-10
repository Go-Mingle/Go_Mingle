/**
 * The explanation a flow hands to `/login` when it sends the partner there
 * instead of finishing (MET-1283).
 *
 * A toast cannot carry this. `message.useMessage()` renders through a
 * `contextHolder` that lives in the calling page's own tree, so a notice raised
 * in the same tick as `navigate('/login')` is destroyed with the page that
 * raised it before it ever paints. That is how an already-registered signup came
 * to drop the partner onto a login screen with nothing to read: the server's
 * "This account already exists. Please sign in." reached the client and was
 * discarded one line later.
 *
 * Router state survives the unmount, and the login screen already has a banner
 * that sits next to the form the partner is now expected to use — which beats a
 * three-second toast for a message that is the whole reason they are there.
 */
export interface AuthRedirectState {
  authNotice?: string
}

/** Router state for a redirect that has something to say. */
export function authRedirectState(notice: string): AuthRedirectState {
  return { authNotice: notice }
}

/**
 * The notice carried by `location.state`, or `''` when there is none.
 *
 * Defensive about the shape: router state is whatever the previous entry put
 * there (including a plain string, or state restored from history after a
 * reload), so anything that is not a string notice reads as absent.
 */
export function readAuthNotice(state: unknown): string {
  const notice = (state as AuthRedirectState | null | undefined)?.authNotice
  return typeof notice === 'string' ? notice : ''
}

/**
 * The server-authored message inside a failed response body.
 *
 * Lives on its own, importing nothing, because both ends of the error path need
 * it and neither may import the other: `httpClient` builds the {@link HttpError}
 * and `utils/apiError` reads it back out, but `utils/apiError` already imports
 * `HttpError` from `httpClient`. One precedence chain in one file is also the
 * only way the message the client throws and the message the UI shows cannot
 * drift apart.
 */

/**
 * The four body shapes the API has used. Not uniform across specs, hence four:
 * `error.details.message`, `error.message` (the canonical Admin F1 envelope),
 * `data.message`, and a bare top-level `message`.
 */
export interface ErrorBody {
  error?: { message?: string; details?: { message?: string } }
  data?: { message?: string }
  message?: string
}

/**
 * Reads the human-readable message out of an error body, or `undefined` when
 * the body carries none (non-JSON page, empty response, bare `{ code }`).
 *
 * **`error.details.message` outranks `error.message`** (MET-1148). Where both
 * are sent, the top-level one is the generic catalogue string for the code and
 * the detail carries the situation-specific copy the spec mandates:
 *
 *     error.message         → "This file type isn't supported for this section."
 *     error.details.message → "Only JPG or PNG photos are allowed."
 *
 * Preferring the generic one would show the partner strictly less than the
 * backend sent. Endpoints that send no detail are unaffected — the chain falls
 * through to the next shape.
 *
 * Blank and whitespace-only strings are skipped rather than returned, so an
 * empty `message: ""` falls through to the next shape instead of resolving to a
 * message that renders as nothing at all.
 */
export function messageFromErrorBody(body: unknown): string | undefined {
  if (body === null || typeof body !== 'object') return undefined

  const shaped = body as ErrorBody
  const candidates = [
    shaped.error?.details?.message,
    shaped.error?.message,
    shaped.data?.message,
    shaped.message,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate
  }
  return undefined
}

import { messageFromErrorBody } from '../api/errorEnvelope'
import { HttpError } from '../api/httpClient'

/**
 * Resolves the message to show the user for a failed API call.
 *
 * Prefers the backend's own wording so server-authored copy reaches the user
 * verbatim — J1's verify endpoint, for instance, distinguishes "That code is
 * incorrect…" from "This code has expired…" and only the backend knows which.
 *
 * The shapes accepted and their precedence live in {@link messageFromErrorBody},
 * shared with `httpClient` so the message thrown and the message shown are
 * resolved by one chain. Falls back to the caller's i18n string for network
 * failures, non-JSON bodies, and anything that is not an `HttpError`.
 *
 * Returns a string only — showing the toast is the caller's job.
 */
export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof HttpError) {
    return messageFromErrorBody(error.responseBody) ?? fallbackMessage
  }
  return fallbackMessage
}

/**
 * How many upcoming interest tables are blocking a delete, from
 * `details.upcomingTables`.
 *
 * Shared because two specs send the identical detail on their in-use guards —
 * J6D's `ERR_MENU_OPTION_IN_USE` and J6E's `ERR_TABLE_IN_USE`.
 *
 * Returns 0 when the count is absent or unusable, so the dialog can fall back to
 * copy that does not name a number rather than saying "used by 0 tables".
 */
export function upcomingTablesCount(error: unknown): number {
  if (!(error instanceof HttpError)) return 0

  const body = error.responseBody as { error?: { details?: { upcomingTables?: unknown } } } | null
  const count = body?.error?.details?.upcomingTables

  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

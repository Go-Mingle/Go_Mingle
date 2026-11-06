import { HttpError } from '../api/httpClient'
import i18n from '../../locales/i18n'
import { getApiErrorMessageKey } from './errorMessages'

/**
 * Resolves a user-facing message for a failed request.
 *
 * Precedence:
 *  1. A localised message for a known backend error code (A-04 — the server's own
 *     text for these is either misleading or unlocalised).
 *  2. The server-supplied message, preserving the behaviour every existing call
 *     site relies on.
 *  3. The caller's fallback.
 */
export function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof HttpError) {
    const mappedKey = getApiErrorMessageKey(error.code)
    if (mappedKey) return i18n.t(mappedKey)

    const body = error.responseBody as { error?: { message?: string } } | null
    if (body?.error?.message) return body.error.message
  }
  return fallbackMessage
}

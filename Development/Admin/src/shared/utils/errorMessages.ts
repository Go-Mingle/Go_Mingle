/**
 * Backend error code → i18n key.
 *
 * A-04 (pentest) — administrator creation checks email uniqueness against the
 * application database but provisions the identity in Cognito, so an address
 * pre-registered by an attacker passes the check and then fails provisioning.
 * The API returns HTTP 500 `ERR_USER_CREATION_FAILED` with "Please try again",
 * advice the report notes "can never succeed". The code was not handled anywhere
 * in the SPA, so that misleading text was rendered verbatim.
 *
 * Mapping a code here takes precedence over the server-supplied message, so
 * known conditions get accurate, localised, actionable copy. Unmapped codes keep
 * the previous behaviour untouched — see `getApiErrorMessage`.
 */
export const API_ERROR_MESSAGE_KEYS: Record<string, string> = {
  ERR_USER_CREATION_FAILED: 'common:apiErrors.ERR_USER_CREATION_FAILED',
  ERR_EMAIL_IN_USE: 'common:apiErrors.ERR_EMAIL_IN_USE',
  ERR_SELF_MODIFICATION: 'common:apiErrors.ERR_SELF_MODIFICATION',
  ERR_LAST_SUPER_ADMIN: 'common:apiErrors.ERR_LAST_SUPER_ADMIN',
  ERR_SERVICE_UNAVAILABLE: 'common:apiErrors.ERR_SERVICE_UNAVAILABLE',
  ERR_ROLE_NOT_FOUND: 'common:apiErrors.ERR_ROLE_NOT_FOUND',
}

/** i18n key for a backend error code, or undefined when the code is unmapped. */
export function getApiErrorMessageKey(code: string | undefined): string | undefined {
  if (!code) return undefined
  return API_ERROR_MESSAGE_KEYS[code]
}

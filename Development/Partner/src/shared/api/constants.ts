/** Canonical backend error codes (Admin F1 catalogue; Partner F1 adds none). */
export const ERROR_CODES = {
  TOKEN_INVALID: 'ERR_TOKEN_INVALID',
  TOKEN_EXPIRED: 'ERR_TOKEN_EXPIRED',
  ACCOUNT_SUSPENDED: 'ERR_ACCOUNT_SUSPENDED',
  NOT_FOUND: 'ERR_NOT_FOUND',
  VALIDATION: 'ERR_VALIDATION',
  SERVICE_UNAVAILABLE: 'ERR_SERVICE_UNAVAILABLE',
  INTERNAL: 'ERR_INTERNAL',
} as const

/** How many times a 503 is retried before the query gives up. */
export const MAX_SERVICE_UNAVAILABLE_RETRIES = 3

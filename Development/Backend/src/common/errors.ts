/**
 * Errors sent to the portals.
 *
 * The standard shape is `{ success: false, error: { code, message, details? } }`.
 * A few contract routes answer with a different body (for example
 * `{ error: { code } }` on a missing role); those pass `body` to send it as is.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
    readonly body?: unknown,
  ) {
    super(message)
  }

  toBody(): unknown {
    if (this.body !== undefined) return this.body
    return {
      success: false,
      error: { code: this.code, message: this.message, ...(this.details !== undefined ? { details: this.details } : {}) },
    }
  }
}

/** `{ success: false, error: { code, message, details? } }` with the given status. */
export function apiError(status: number, code: string, message: string, details?: unknown): ApiError {
  return new ApiError(status, code, message, details)
}

/** An error whose body is sent exactly as given. */
export function rawError(status: number, body: unknown): ApiError {
  const code = (body as { error?: { code?: string } })?.error?.code ?? 'ERR'
  return new ApiError(status, code, code, undefined, body)
}

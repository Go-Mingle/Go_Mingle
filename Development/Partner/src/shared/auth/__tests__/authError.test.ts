import { describe, it, expect } from 'vitest'
import { AuthError } from '../authError'

describe('AuthError', () => {
  it('carries the code and keeps the supplied message', () => {
    const error = new AuthError('INVALID_CREDENTIALS', 'Incorrect username or password.')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('AuthError')
    expect(error.code).toBe('INVALID_CREDENTIALS')
    expect(error.message).toBe('Incorrect username or password.')
  })

  it('falls back to the code as the message', () => {
    expect(new AuthError('REFRESH_FAILED').message).toBe('REFRESH_FAILED')
  })
})

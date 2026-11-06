import { describe, it, expect } from 'vitest'
import authCopy from '../../../../locales/en/auth.json'

/**
 * MET-1278 — the signup, login and reset-password screens all share one
 * `emailPlaceholder`, and it used to read `you@gomingle.com`. Signup is for
 * restaurant partners, so no auth-facing string may carry an internal
 * GoMingle address.
 */
describe('auth copy', () => {
  it('shows a restaurant-shaped example address in the email placeholder', () => {
    expect(authCopy.emailPlaceholder).toBe('you@yourrestaurant.com')
  })

  it('never leaks an internal domain into any auth string', () => {
    const flatten = (value: unknown): string[] => {
      if (typeof value === 'string') return [value]
      if (value !== null && typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).flatMap(flatten)
      }
      return []
    }

    // Any e-mail address in partner-facing auth copy must be restaurant-shaped.
    const offenders = flatten(authCopy).filter((copy) => /@gomingle\.com/i.test(copy))
    expect(offenders).toEqual([])
  })
})

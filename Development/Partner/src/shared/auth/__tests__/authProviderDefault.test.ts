import { describe, it, expect } from 'vitest'
import { getAuthProvider, isCognitoConfigured } from '../authProvider'
import { mockAuthProvider } from '../mockAuthProvider'

/**
 * Deliberately does NOT mock `configs/env`, unlike authProvider.test.ts.
 *
 * Vitest loads `.env` files, so a developer with real Cognito pool ids in their
 * local `.env` would otherwise silently flip the whole suite onto the real
 * Cognito adapter — which then tries to reach a live pool and fails in
 * confusing, unrelated places. `vite.config.ts` pins the relevant values under
 * `test.env`; this asserts that pinning is actually in effect.
 */
describe('auth provider default in the test environment', () => {
  it('reports Cognito as unconfigured', () => {
    expect(isCognitoConfigured()).toBe(false)
  })

  it('resolves to the mock provider', () => {
    expect(getAuthProvider()).toBe(mockAuthProvider)
  })
})

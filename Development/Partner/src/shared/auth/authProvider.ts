import { ENV } from '../../configs/env'
import { apiAuthProvider } from './apiAuthProvider'
import { cognitoAuthProvider } from './cognitoAuthProvider'
import { mockAuthProvider } from './mockAuthProvider'
import type { PartnerAuthProvider } from './types'

/** True once DevOps has provisioned the pool and both ids are in the build env. */
export function isCognitoConfigured(): boolean {
  return Boolean(ENV.COGNITO_PARTNERS_POOL_ID && ENV.COGNITO_PARTNERS_CLIENT_ID)
}

let override: PartnerAuthProvider | null = null

/** Test-only injection point. Pass `null` to restore env-based selection. */
export function setAuthProvider(provider: PartnerAuthProvider | null): void {
  override = provider
}

/**
 * The single place the app resolves an auth provider. Everything above this
 * line is identical whether we are talking to Cognito or to the mock.
 */
export function getAuthProvider(): PartnerAuthProvider {
  if (override) return override
  if (ENV.AUTH_MODE === 'api') return apiAuthProvider
  if (ENV.AUTH_MODE === 'mock') return mockAuthProvider
  if (ENV.AUTH_MODE === 'cognito') return cognitoAuthProvider
  return isCognitoConfigured() ? cognitoAuthProvider : mockAuthProvider
}

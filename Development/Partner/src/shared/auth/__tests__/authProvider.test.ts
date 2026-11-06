import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { PartnerAuthProvider } from '../types'

const envMock = { COGNITO_PARTNERS_POOL_ID: '', COGNITO_PARTNERS_CLIENT_ID: '', AUTH_MODE: '' }

vi.mock('../../../configs/env', () => ({
  get ENV() {
    return envMock
  },
}))

const { cognitoAuthProvider } = await import('../cognitoAuthProvider')
const { apiAuthProvider } = await import('../apiAuthProvider')
const { mockAuthProvider } = await import('../mockAuthProvider')
const { getAuthProvider, isCognitoConfigured, setAuthProvider } = await import('../authProvider')

beforeEach(() => {
  envMock.COGNITO_PARTNERS_POOL_ID = ''
  envMock.COGNITO_PARTNERS_CLIENT_ID = ''
  envMock.AUTH_MODE = ''
})

describe('VITE_AUTH_MODE', () => {
  it('selects the GoMingle backend provider for "api"', () => {
    envMock.AUTH_MODE = 'api'
    expect(getAuthProvider()).toBe(apiAuthProvider)
  })

  it('selects the mock provider for "mock" even when Cognito is configured', () => {
    envMock.COGNITO_PARTNERS_POOL_ID = 'me-central-1_abc'
    envMock.COGNITO_PARTNERS_CLIENT_ID = 'client-abc'
    envMock.AUTH_MODE = 'mock'
    expect(getAuthProvider()).toBe(mockAuthProvider)
  })

  it('selects Cognito for "cognito"', () => {
    envMock.AUTH_MODE = 'cognito'
    expect(getAuthProvider()).toBe(cognitoAuthProvider)
  })
})

afterEach(() => {
  setAuthProvider(null)
})

describe('isCognitoConfigured', () => {
  it('is false when neither id is set', () => {
    expect(isCognitoConfigured()).toBe(false)
  })

  it('is false when only the pool id is set', () => {
    envMock.COGNITO_PARTNERS_POOL_ID = 'me-central-1_abc'
    expect(isCognitoConfigured()).toBe(false)
  })

  it('is false when only the client id is set', () => {
    envMock.COGNITO_PARTNERS_CLIENT_ID = 'client-abc'
    expect(isCognitoConfigured()).toBe(false)
  })

  it('is true when both are set', () => {
    envMock.COGNITO_PARTNERS_POOL_ID = 'me-central-1_abc'
    envMock.COGNITO_PARTNERS_CLIENT_ID = 'client-abc'
    expect(isCognitoConfigured()).toBe(true)
  })
})

describe('getAuthProvider', () => {
  it('falls back to the mock provider until DevOps provisions the pool', () => {
    expect(getAuthProvider()).toBe(mockAuthProvider)
  })

  it('selects the Cognito provider once both ids are present', () => {
    envMock.COGNITO_PARTNERS_POOL_ID = 'me-central-1_abc'
    envMock.COGNITO_PARTNERS_CLIENT_ID = 'client-abc'
    expect(getAuthProvider()).toBe(cognitoAuthProvider)
  })

  it('honours an explicit override regardless of env', () => {
    const stub = { getAccessToken: () => 'stub' } as unknown as PartnerAuthProvider
    setAuthProvider(stub)
    expect(getAuthProvider()).toBe(stub)

    envMock.COGNITO_PARTNERS_POOL_ID = 'me-central-1_abc'
    envMock.COGNITO_PARTNERS_CLIENT_ID = 'client-abc'
    expect(getAuthProvider()).toBe(stub)
  })

  it('restores env-based selection when the override is cleared', () => {
    setAuthProvider({ getAccessToken: () => 'stub' } as unknown as PartnerAuthProvider)
    setAuthProvider(null)
    expect(getAuthProvider()).toBe(mockAuthProvider)
  })
})

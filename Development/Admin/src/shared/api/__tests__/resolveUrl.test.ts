import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { httpClient } from '../httpClient'

// These tests exercise the private resolveUrl helper through httpClient.
// resolveUrl prefixes the configured API base URL only when mocks are
// disabled (VITE_MSW_ENABLED === 'false') AND a base URL is configured.
// We replace global.fetch so MSW does not intercept and we can inspect the
// exact URL the client requests.
describe('httpClient resolveUrl — real API base URL prefixing', () => {
  let fetchSpy: ReturnType<typeof vi.fn>
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { ok: true } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    globalThis.fetch = fetchSpy as unknown as typeof fetch
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    globalThis.fetch = originalFetch
  })

  it('prefixes the API base URL when mocks are disabled and a base URL is set', async () => {
    vi.stubEnv('VITE_MSW_ENABLED', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://devapi.gomingle.com')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('https://devapi.gomingle.com/api/v1/minglers')
  })

  it('strips a trailing slash from the base URL before prefixing', async () => {
    vi.stubEnv('VITE_MSW_ENABLED', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://devapi.gomingle.com/')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy.mock.calls[0][0]).toBe('https://devapi.gomingle.com/api/v1/minglers')
  })

  it('keeps the URL relative when mocks are enabled via VITE_MSW_ENABLED', async () => {
    vi.stubEnv('VITE_MSW_ENABLED', 'true')
    vi.stubEnv('VITE_API_BASE_URL', 'https://devapi.gomingle.com')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/v1/minglers')
  })

  it('falls back to DEV when VITE_MSW_ENABLED is unset — DEV=false keeps the old prod-build behavior', async () => {
    // CI/production builds never set VITE_MSW_ENABLED, so this must keep
    // prefixing the real API base URL exactly as it did before this flag existed.
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_MSW_ENABLED', undefined)
    vi.stubEnv('VITE_API_BASE_URL', 'https://devapi.gomingle.com')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy.mock.calls[0][0]).toBe('https://devapi.gomingle.com/api/v1/minglers')
  })

  it('falls back to DEV when VITE_MSW_ENABLED is unset — DEV=true keeps the old dev-mode default of mocks on', async () => {
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MSW_ENABLED', undefined)
    vi.stubEnv('VITE_API_BASE_URL', 'https://devapi.gomingle.com')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/v1/minglers')
  })

  it('prefixes the base URL even when DEV is true, as long as mocks are explicitly disabled', async () => {
    // Regression guard for the bug being fixed: DEV mode must not force
    // mocks on when VITE_MSW_ENABLED=false is set explicitly (e.g. running
    // `npm run dev` locally against a real backend).
    vi.stubEnv('DEV', true)
    vi.stubEnv('VITE_MSW_ENABLED', 'false')
    vi.stubEnv('VITE_API_BASE_URL', 'https://devapi.gomingle.com')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy.mock.calls[0][0]).toBe('https://devapi.gomingle.com/api/v1/minglers')
  })

  it('keeps mocks on even when DEV is false, as long as mocks are explicitly enabled', async () => {
    vi.stubEnv('DEV', false)
    vi.stubEnv('VITE_MSW_ENABLED', 'true')
    vi.stubEnv('VITE_API_BASE_URL', 'https://devapi.gomingle.com')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/v1/minglers')
  })

  it('keeps the URL relative when no base URL is configured', async () => {
    vi.stubEnv('VITE_MSW_ENABLED', 'false')
    vi.stubEnv('VITE_API_BASE_URL', '')

    await httpClient.get('/api/v1/minglers')

    expect(fetchSpy.mock.calls[0][0]).toBe('/api/v1/minglers')
  })
})

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Sentry must be mocked before the module under test is imported so `init` is a spy.
// The integration factories are stubbed to identifiable markers so the test can
// assert that tracing and replay are actually registered — without them the
// sample rates passed to `init` would be silently inert (SDK v8+ enables
// neither by default).
const initMock = vi.fn()
vi.mock('@sentry/react', () => ({
  init: (...args: unknown[]) => initMock(...args),
  browserTracingIntegration: () => ({ name: 'BrowserTracing' }),
  replayIntegration: (options?: unknown) => ({ name: 'Replay', options }),
}))

// ENV is frozen at module load, so each case re-imports with a fresh value.
async function loadWithDsn(dsn: string | undefined, prod = false) {
  vi.resetModules()
  vi.doMock('../env', () => ({ ENV: { SENTRY_DSN: dsn ?? '', APP_VERSION: '1.2.3' } }))
  vi.stubEnv('PROD', prod)
  return import('../sentry')
}

describe('isValidSentryDsn', () => {
  beforeEach(() => {
    initMock.mockClear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('../env')
  })

  it('accepts a well-formed DSN', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('https://abc123def@o12345.ingest.sentry.io/4567')).toBe(true)
  })

  it('rejects empty, whitespace-only and undefined values', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn(undefined)).toBe(false)
    expect(isValidSentryDsn('')).toBe(false)
    expect(isValidSentryDsn('   ')).toBe(false)
  })

  // A-11 — this exact string shipped to production and silently disabled telemetry.
  it('rejects the placeholder DSN that shipped to production', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('https://your-dsn@sentry.io/0')).toBe(false)
  })

  it('rejects other placeholder markers', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('https://key@example.com/1')).toBe(false)
    expect(isValidSentryDsn('https://changeme@o1.ingest.sentry.io/2')).toBe(false)
    expect(isValidSentryDsn('https://<key>@o1.ingest.sentry.io/2')).toBe(false)
  })

  it('rejects project id 0', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('https://abc@o1.ingest.sentry.io/0')).toBe(false)
  })

  it('rejects a malformed URL', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('not-a-url')).toBe(false)
  })

  it('rejects a non-http protocol', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('ftp://abc@o1.ingest.sentry.io/1')).toBe(false)
  })

  it('rejects a DSN with no public key', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('https://o1.ingest.sentry.io/1')).toBe(false)
  })

  it('rejects a non-numeric or missing project id', async () => {
    const { isValidSentryDsn } = await loadWithDsn(undefined)
    expect(isValidSentryDsn('https://abc@o1.ingest.sentry.io/notanumber')).toBe(false)
    expect(isValidSentryDsn('https://abc@o1.ingest.sentry.io')).toBe(false)
    expect(isValidSentryDsn('https://abc@o1.ingest.sentry.io/1/2')).toBe(false)
  })
})

describe('initSentry', () => {
  beforeEach(() => {
    initMock.mockClear()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.doUnmock('../env')
    vi.restoreAllMocks()
  })

  it('initialises Sentry when the DSN is valid', async () => {
    const { initSentry } = await loadWithDsn('https://abc123@o12345.ingest.sentry.io/4567')
    expect(initSentry()).toBe(true)
    expect(initMock).toHaveBeenCalledTimes(1)
    expect(initMock.mock.calls[0][0]).toMatchObject({
      dsn: 'https://abc123@o12345.ingest.sentry.io/4567',
    })
  })

  it('tags events with the build release', async () => {
    const { initSentry } = await loadWithDsn('https://abc123@o12345.ingest.sentry.io/4567')
    initSentry()
    expect(initMock.mock.calls[0][0]).toMatchObject({ release: '1.2.3' })
  })

  // Without these registered, tracesSampleRate/replays*SampleRate do nothing.
  it('registers the tracing and replay integrations', async () => {
    const { initSentry } = await loadWithDsn('https://abc123@o12345.ingest.sentry.io/4567')
    initSentry()
    const { integrations } = initMock.mock.calls[0][0] as {
      integrations: { name: string }[]
    }
    expect(integrations.map((i) => i.name)).toEqual(['BrowserTracing', 'Replay'])
  })

  it('masks all text and media in session replays', async () => {
    const { initSentry } = await loadWithDsn('https://abc123@o12345.ingest.sentry.io/4567')
    initSentry()
    const { integrations } = initMock.mock.calls[0][0] as {
      integrations: { name: string; options?: unknown }[]
    }
    const replay = integrations.find((i) => i.name === 'Replay')
    expect(replay?.options).toEqual({ maskAllText: true, blockAllMedia: true })
  })

  it('does not initialise Sentry when the DSN is a placeholder', async () => {
    const { initSentry } = await loadWithDsn('https://your-dsn@sentry.io/0')
    expect(initSentry()).toBe(false)
    expect(initMock).not.toHaveBeenCalled()
  })

  it('does not initialise Sentry when the DSN is absent', async () => {
    const { initSentry } = await loadWithDsn('')
    expect(initSentry()).toBe(false)
    expect(initMock).not.toHaveBeenCalled()
  })

  // A-11 remediation: a deployed build without telemetry must not fail silently.
  it('logs an error in a production build when the DSN is unusable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { initSentry } = await loadWithDsn('https://your-dsn@sentry.io/0', true)
    expect(initSentry()).toBe(false)
    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(String(errorSpy.mock.calls[0][0])).toMatch(/VITE_SENTRY_DSN/)
  })

  it('stays quiet in a non-production build when the DSN is unusable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { initSentry } = await loadWithDsn('', false)
    expect(initSentry()).toBe(false)
    expect(errorSpy).not.toHaveBeenCalled()
  })
})

import * as Sentry from '@sentry/react'
import { ENV } from './env'

/**
 * A-11 (pentest) — the portal shipped `https://your-dsn@sentry.io/0`, so
 * `Sentry.init` succeeded, the SDK logged "Invalid Sentry Dsn" on every load and
 * every `captureException` was discarded. The audit finding is rated High
 * partly because no error telemetry was reaching anyone at all.
 *
 * The DSN is therefore validated before init, and a deployed build that lacks a
 * usable DSN says so loudly rather than degrading in silence.
 */

/** Placeholder fragments that ship in `.env.example` / CI templates. */
const PLACEHOLDER_MARKERS = ['your-dsn', 'your_dsn', 'example.com', 'changeme', '<', '>']

/**
 * A usable Sentry DSN is `https://<publicKey>@<host>/<projectId>` with a
 * non-zero numeric project id. Anything else — empty, placeholder or malformed —
 * is treated as absent.
 */
export function isValidSentryDsn(dsn: string | undefined): boolean {
  if (!dsn) return false

  const trimmed = dsn.trim()
  if (!trimmed) return false

  const lowered = trimmed.toLowerCase()
  if (PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker))) return false

  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
  // The public key is carried in the username position.
  if (!parsed.username) return false
  if (!parsed.hostname) return false

  // Path must be a single non-zero numeric project id. Project id 0 is the
  // placeholder Sentry's own docs use and is never issued.
  const projectId = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!/^[1-9][0-9]*$/.test(projectId)) return false

  return true
}

/**
 * Initialise Sentry only when the DSN is usable. Returns whether init ran, so
 * callers (and tests) can assert the decision.
 */
export function initSentry(): boolean {
  const dsn = ENV.SENTRY_DSN

  if (!isValidSentryDsn(dsn)) {
    if (import.meta.env.PROD) {
      // Deliberately loud: a production build with no telemetry is an
      // operational defect that must not be discoverable only by a pentest.
      console.error(
        '[sentry] VITE_SENTRY_DSN is missing or invalid — error telemetry is DISABLED for this build. ' +
          'Set a real DSN in the deployment environment.',
      )
    }
    return false
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
    // Ties every event to a build so regressions are attributable to a release.
    release: ENV.APP_VERSION,
    // Neither tracing nor replay is a default integration in SDK v8+, so the
    // sample rates below are inert unless both are registered explicitly.
    integrations: [
      Sentry.browserTracingIntegration(),
      // Super-admin screens render member and finance data, so the replay is
      // masked at source: nothing legible leaves the browser.
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
  return true
}

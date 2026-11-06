import * as Sentry from '@sentry/react'
import { ENV } from '../../configs/env'
import { scrubTokens } from '../api/scrubTokens'
import type { PartnerSession } from '../../app/modules/session/types'

/**
 * The single place Sentry is configured and told who is using the app.
 *
 * Reporting itself stays at the call sites that already do it — `httpClient`
 * (every non-2xx and every network failure), `cognitoAuthProvider` (auth
 * failures that are our fault rather than a wrong password), `useSignUpFlow`,
 * and the `Sentry.ErrorBoundary` in App.tsx for render crashes. This module
 * exists so that the *context* around those reports — release, environment,
 * which partner, which restaurant — is set in one place instead of being
 * rediscovered per feature.
 */

/** Release name Sentry groups issues under. Matches the deployed bundle. */
const RELEASE = `gomingle-partner-web@${ENV.APP_VERSION}`

/**
 * Configures the SDK. Called once, first thing, from main.tsx — before the app
 * renders, so a crash during bootstrap is still reported.
 *
 * Without a DSN there is nothing to send to, so the SDK is not installed at
 * all: the global error and unhandled-rejection handlers, the fetch/history
 * instrumentation and the breadcrumb recorder are never attached. That keeps a
 * DSN-less build (a developer's checkout, a PR preview) behaving exactly as it
 * did before Sentry existed.
 */
export function initSentry(): void {
  if (!ENV.SENTRY_DSN) return

  Sentry.init({
    dsn: ENV.SENTRY_DSN,
    environment: import.meta.env.MODE,
    // PROD-only. `cognitoAuthProvider.reportAuthFailure` compensates in dev by
    // also writing to the console — see the comment there before changing this.
    enabled: import.meta.env.PROD,
    release: RELEASE,

    /**
     * Pageload and navigation spans. Enabled mainly for what it does to error
     * reports rather than for the performance data: it records navigation
     * breadcrumbs, so an issue shows the route the partner was on and the
     * screens they came through, instead of a bare stack trace.
     *
     * `tracePropagationTargets` is deliberately left at its default
     * (same-origin + localhost). Naming the API origin here would add
     * `sentry-trace` and `baggage` headers to every cross-origin API call,
     * which the backend's CORS policy would have to allow — and until it did,
     * the preflight would fail and every request with it.
     */
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.2,

    // Session Replay is intentionally not enabled. It records the DOM, and
    // these screens carry partner financials, customer reviews and contact
    // details; turning it on is a privacy decision for the team, not a default.
    // To enable: add `Sentry.replayIntegration({ maskAllText: true,
    // blockAllMedia: true })` above and set the two `replays*SampleRate` options.

    // FE1 BR-11 — no token may reach an error report. Call sites scrub what they
    // attach; this is the backstop for breadcrumbs, request data and anything a
    // future integration adds without knowing the rule.
    beforeSend: (event) => scrubTokens(event),
    beforeBreadcrumb: (breadcrumb) => scrubTokens(breadcrumb),
  })
}

/**
 * Attributes every subsequent report to the signed-in partner.
 *
 * Called from `SessionBoundary`, because the session response is the first
 * point where both the user and their restaurant are known. Before this, issues
 * arrived anonymous: a report from a multi-tenant portal that does not say which
 * restaurant it came from cannot be reproduced, and "one partner is broken"
 * cannot be told from "everyone is".
 *
 * `id` and `email` identify the person; the restaurant goes on tags so Sentry
 * can filter and group by tenant. No token is passed in and none is derivable
 * from these fields.
 */
export function setSentryUser(session: PartnerSession): void {
  Sentry.setUser({
    id: session.partnerUser.id,
    email: session.partnerUser.email,
  })
  Sentry.setTags({
    restaurantId: session.restaurant.id,
    restaurantStatus: session.restaurant.status,
    partnerRoute: session.route,
    // BR-08 — primary-only actions fail differently for a member.
    isPrimaryUser: String(session.partnerUser.isPrimary),
  })
}

/**
 * Drops the partner context when the session ends.
 *
 * Both exits go through here — the user signing out (UserMenuDropdown) and the
 * session being terminated under them (SessionWatcher). The tab survives both,
 * so without this the next person to sign in on this machine inherits the
 * previous partner's id, email and restaurant on their reports.
 */
export function clearSentryUser(): void {
  Sentry.setUser(null)
  Sentry.setTags({
    restaurantId: undefined,
    restaurantStatus: undefined,
    partnerRoute: undefined,
    isPrimaryUser: undefined,
  })
}

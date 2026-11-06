import { expect } from 'vitest'

const PENDING = Symbol('pending')

/**
 * Asserts a request was **discarded** rather than failed (FE1 BR-07).
 *
 * On a terminal auth outcome the HTTP client ends the session and abandons the
 * caller instead of rejecting: "Any queued request is discarded rather than
 * surfaced as an error, so the user sees one clean transition, not a cascade of
 * failures." The promise therefore never settles.
 *
 * Race it against a tick to prove that. Never `await` such a promise directly —
 * the test would hang until the suite times out.
 */
export async function expectDiscarded(promise: Promise<unknown>): Promise<void> {
  // Pre-attach so an unexpected rejection cannot surface as unhandled.
  void promise.catch(() => undefined)
  const outcome = await Promise.race([
    promise.then(
      () => 'resolved' as const,
      () => 'rejected' as const,
    ),
    new Promise<typeof PENDING>((resolve) => setTimeout(() => resolve(PENDING), 20)),
  ])
  expect(outcome).toBe(PENDING)
}

import { describe, it, expect } from 'vitest'
import { PORTAL_ROUTES, routeToPath } from '../routePaths'
import type { PartnerRoute } from '../types'

describe('routeToPath', () => {
  /**
   * Every known state lands on the profile. It is the page that already renders
   * the right affordances per status — the decline history and resubmit for
   * REJECTED (J6A BR-13, AC-07.6), read-only with a banner for PENDING (BR-03) —
   * so no lifecycle state needs a screen of its own.
   */
  it.each([
    ['PROFILE_SETUP', '/overview'],
    ['UNDER_REVIEW', '/overview'],
    ['FULL_PORTAL', '/overview'],
    ['REJECTED', '/overview'],
  ] as const)('maps %s to %s', (route, path) => {
    expect(routeToPath(route)).toBe(path)
  })

  it('falls back to login for a route the backend adds later', () => {
    expect(routeToPath('SOMETHING_NEW' as PartnerRoute)).toBe('/login')
  })
})

describe('PORTAL_ROUTES', () => {
  /**
   * The assertion whose absence let a declined partner ship locked out: the
   * allow-list and `routeToPath` disagreed, so the guard bounced REJECTED off
   * the very path it had just been sent to.
   */
  it('admits a declined partner so they can revise and resubmit', () => {
    expect(PORTAL_ROUTES).toContain('REJECTED')
  })

  it.each(['FULL_PORTAL', 'PROFILE_SETUP', 'UNDER_REVIEW'] as const)(
    'admits a %s partner',
    (route) => {
      expect(PORTAL_ROUTES).toContain(route)
    },
  )

  /**
   * Not a blanket allow: a route the backend adds later is absent, so the guard
   * fails closed on it rather than rendering a portal for a state nobody has
   * reasoned about.
   */
  it('does not admit a route the backend adds later', () => {
    expect(PORTAL_ROUTES).not.toContain('SOMETHING_NEW')
  })

  /** Every entry must be somewhere `routeToPath` can actually send a partner. */
  it('only lists routes that resolve to a real path', () => {
    for (const route of PORTAL_ROUTES) {
      expect(routeToPath(route)).not.toBe('/login')
    }
  })
})

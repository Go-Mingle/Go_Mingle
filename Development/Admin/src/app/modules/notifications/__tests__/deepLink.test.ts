import { describe, it, expect } from 'vitest'
import { resolveDeepLink } from '../deepLink'
import type { NotificationItem } from '../types'

// Helper: build the minimal notification slice the resolver needs.
function notif(
  deepLink: string | null,
  metadata: Record<string, unknown> = {},
): Pick<NotificationItem, 'deepLink' | 'metadata'> {
  return { deepLink, metadata }
}

describe('resolveDeepLink', () => {
  it('routes /admin/approvals/:id to the restaurant detail page when metadata has a restaurantId', () => {
    expect(resolveDeepLink(notif('/admin/approvals/xxx', { restaurantId: 'rest1' }))).toBe(
      '/restaurants/rest1',
    )
  })

  it('routes /admin/approvals/:id to the approval-queue listing when metadata has no restaurantId', () => {
    expect(resolveDeepLink(notif('/admin/approvals/xxx'))).toBe('/approval-queue')
  })

  it('treats /admin/restaurant-approvals the same as /admin/approvals', () => {
    expect(resolveDeepLink(notif('/admin/restaurant-approvals/xxx', { restaurantId: 'r9' }))).toBe(
      '/restaurants/r9',
    )
    expect(resolveDeepLink(notif('/admin/restaurant-approvals/xxx'))).toBe('/approval-queue')
  })

  it('strips the /admin prefix for a known segment', () => {
    expect(resolveDeepLink(notif('/admin/restaurants/rest1'))).toBe('/restaurants/rest1')
    expect(resolveDeepLink(notif('/admin/minglers/m1'))).toBe('/minglers/m1')
  })

  it('maps a bare list segment without a trailing id', () => {
    expect(resolveDeepLink(notif('/admin/finances'))).toBe('/finances')
  })

  it('handles links that already lack the /admin prefix', () => {
    expect(resolveDeepLink(notif('/restaurants/42'))).toBe('/restaurants/42')
  })

  it('ignores query strings and hashes', () => {
    expect(resolveDeepLink(notif('/admin/restaurants/rest1?tab=menu'))).toBe('/restaurants/rest1')
    expect(resolveDeepLink(notif('/admin/restaurants/rest1#reviews'))).toBe('/restaurants/rest1')
  })

  it('returns null for null, empty, or unmappable links', () => {
    expect(resolveDeepLink(notif(null))).toBeNull()
    expect(resolveDeepLink(notif(''))).toBeNull()
    expect(resolveDeepLink(notif('/admin'))).toBeNull()
    expect(resolveDeepLink(notif('/admin/unknown-thing/123'))).toBeNull()
  })
})

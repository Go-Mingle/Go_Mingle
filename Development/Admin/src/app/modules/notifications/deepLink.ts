import type { NotificationItem } from './types'

// Notification deepLinks arrive from the backend with an `/admin/...` prefix and
// occasionally use segment names that differ from our app routes (e.g.
// `/admin/restaurants/{id}` → `/restaurants/{id}`). This resolver normalises a
// deepLink to an in-app route path, returning null when it cannot be mapped so
// the caller can stay put instead of navigating somewhere broken.

// Maps the deepLink's first path segment to the corresponding app-route segment.
// Keys include both the backend's naming and our own (identity) so either form resolves.
const SEGMENT_MAP: Record<string, string> = {
  restaurants: 'restaurants',
  minglers: 'minglers',
  finances: 'finances',
  users: 'users',
  'roles-access': 'roles-access',
  categories: 'categories',
  interests: 'interests',
  'interest-topics': 'interest-topics',
  amenities: 'amenities',
  'preference-questions': 'preference-questions',
  'timer-settings': 'timer-settings',
  loyalty: 'loyalty',
  'change-log': 'change-log',
  notifications: 'notifications',
  dashboard: 'dashboard',
}

// Approval deepLinks (`/admin/approvals/{id}` or `/admin/restaurant-approvals/{id}`)
// carry a restaurant id that our approval-queue detail page can't load, so we route
// to the restaurant detail page when metadata provides the id, else the queue listing.
const APPROVAL_SEGMENTS = new Set(['approvals', 'restaurant-approvals'])

/**
 * Resolve a notification's deepLink to an in-app route path.
 * @returns the mapped route (e.g. `/restaurants/01HXR`) or null if unmappable.
 */
export function resolveDeepLink(
  notification: Pick<NotificationItem, 'deepLink' | 'metadata'>,
): string | null {
  const { deepLink, metadata } = notification
  if (!deepLink) return null

  // Drop query/hash and a leading `/admin` prefix, then split into segments.
  const pathOnly = deepLink.split(/[?#]/)[0]
  const withoutAdmin = pathOnly.replace(/^\/?admin(?=\/|$)/, '')
  const segments = withoutAdmin.split('/').filter(Boolean)
  if (segments.length === 0) return null

  const [first, ...rest] = segments

  if (APPROVAL_SEGMENTS.has(first)) {
    const restaurantId = metadata?.restaurantId
    return typeof restaurantId === 'string' ? `/restaurants/${restaurantId}` : '/approval-queue'
  }

  const mapped = SEGMENT_MAP[first]
  if (!mapped) return null

  return `/${[mapped, ...rest].join('/')}`
}

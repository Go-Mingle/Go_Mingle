import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { ADMIN_API, PARTNER_API, BAD_TEXT, adminToken, badNumbers, call, partnerToken, strings, type Reply } from './support/api'
import { API_URL, SEED_FILE, STATE_DIR } from './support/env'

/**
 * Every read endpoint of both portals, called with the seeded data. Each must
 * answer without a server error, quickly, and with no broken values in the body
 * ("undefined", "NaN", "[object Object]", non-finite numbers).
 */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))

/** Slower than this on a local machine is worth a look. */
const SLOW_MS = 800

function adminRoutes(rid: string, itId: string): string[] {
  return [
    '/auth/me',
    '/roles',
    '/roles/active',
    '/roles/permission-keys',
    '/users',
    `/admin/bookings?interestTableId=${itId}`,
    '/amenities',
    '/amenities/active',
    '/categories',
    '/categories/active',
    '/interests',
    '/interests/active',
    '/loyalty-configuration',
    '/preference-questions',
    '/preference-questions/active',
    '/topics',
    '/topics/active',
    '/change-log',
    '/email-templates',
    '/email-templates/log',
    '/email-templates/partner_signup_code',
    '/escrow',
    '/admin/finances',
    '/interest-tables',
    `/restaurants/${rid}/interest-tables`,
    `/restaurants/${rid}/lookups/interest-tables`,
    `/interest-tables/${itId}`,
    `/interest-tables/${itId}/menu-options`,
    `/interest-tables/${itId}/invitees`,
    '/minglers',
    '/minglers/prominglers/active',
    `/restaurants/${rid}/reviews`,
    '/admin/reviews',
    '/notifications',
    '/notifications/unread-count',
    '/notifications/recent',
    '/notifications/types',
    '/admin/approvals',
    '/restaurants',
    `/restaurants/${rid}`,
    `/restaurants/${rid}/contacts`,
    `/restaurants/${rid}/tables`,
    `/restaurants/${rid}/menu-options`,
    `/restaurants/${rid}/amenities`,
    `/restaurants/${rid}/media`,
    `/restaurants/${rid}/bookings/count-active`,
  ]
}

function partnerRoutes(itId: string): string[] {
  return [
    '/session',
    '/me',
    '/users',
    '/restaurant',
    '/restaurant/contacts',
    '/restaurant/amenities',
    '/restaurant/media',
    '/restaurant/documents',
    '/restaurant/payout-account',
    '/restaurant/no-show-policy',
    '/restaurant/menu-options',
    '/restaurant/tables',
    '/restaurant/menu-pdf',
    '/escrow',
    '/interest-tables',
    `/interest-tables/${itId}`,
    `/interest-tables/${itId}/bookings`,
    `/interest-tables/${itId}/menu-options`,
    `/interest-tables/${itId}/invitees`,
    '/reviews',
    '/notifications',
    '/notifications/unread-count',
    '/notifications/recent',
    '/notifications/types',
    '/webhook',
    '/webhook/deliveries',
  ]
}

/** 404 is a fair answer where nothing exists yet (no menu PDF, no reviews, no webhook). */
const MAY_BE_EMPTY = /menu-pdf|\/webhook$|\/reviews$/

function checkBody(label: string, r: Reply) {
  for (const [path, value] of strings(r.json)) {
    expect(BAD_TEXT.test(value), `${label}: broken text at ${path}: "${value}"`).toBe(false)
  }
  expect([...badNumbers(r.json)], `${label}: non-finite numbers`).toEqual([])
}

test('every read endpoint answers cleanly and quickly', async () => {
  const { restaurantId, interestTableId } = seed()
  const A = await adminToken()
  const P = await partnerToken()
  const timings: { route: string; ms: number; status: number }[] = []

  for (const route of adminRoutes(restaurantId, interestTableId)) {
    const r = await call('GET', `${ADMIN_API}${route}`, A)
    timings.push({ route: `admin ${route}`, ms: r.ms, status: r.status })
    expect.soft(r.status, `admin ${route}`).toBe(200)
    checkBody(`admin ${route}`, r)
  }
  for (const route of ['/dashboard/stats', '/dashboard/revenue-chart', '/dashboard/bookings-chart', '/timer-settings']) {
    const r = await call('GET', `${API_URL}/admin/api${route}`, A)
    timings.push({ route: `admin ${route}`, ms: r.ms, status: r.status })
    expect.soft(r.status, `admin ${route}`).toBe(200)
    checkBody(`admin ${route}`, r)
  }
  for (const route of partnerRoutes(interestTableId)) {
    const r = await call('GET', `${PARTNER_API}${route}`, P)
    timings.push({ route: `partner ${route}`, ms: r.ms, status: r.status })
    if (MAY_BE_EMPTY.test(route)) expect.soft([200, 404], `partner ${route}`).toContain(r.status)
    else expect.soft(r.status, `partner ${route}`).toBe(200)
    checkBody(`partner ${route}`, r)
  }

  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(`${STATE_DIR}api-timings.json`, JSON.stringify(timings.sort((a, b) => b.ms - a.ms), null, 2))
  const slow = timings.filter((t) => t.ms > SLOW_MS)
  expect.soft(slow, 'slow endpoints').toEqual([])
})

test('every endpoint refuses a missing or wrong token', async () => {
  const { restaurantId, interestTableId } = seed()
  const P = await partnerToken()
  for (const route of adminRoutes(restaurantId, interestTableId)) {
    expect.soft((await call('GET', `${ADMIN_API}${route}`)).status, `admin ${route} without token`).toBe(401)
    // A partner token is not an admin token.
    expect.soft((await call('GET', `${ADMIN_API}${route}`, P)).status, `admin ${route} with partner token`).toBe(401)
  }
  for (const route of partnerRoutes(interestTableId)) {
    expect.soft((await call('GET', `${PARTNER_API}${route}`)).status, `partner ${route} without token`).toBe(401)
  }
})

import fs from 'node:fs'
import { test as setup, expect } from '@playwright/test'
import { ADMIN_API, PARTNER_API, adminToken, call, itemsOf, ok, partnerToken, unwrap } from './support/api'
import { ADMIN, ADMIN_STORAGE, ADMIN_URL, PARTNER, PARTNER_STORAGE, PARTNER_URL, SEED_FILE, STATE_DIR } from './support/env'

/**
 * One realistic journey through the API, so every screen has something to show:
 * the partner fills in the restaurant and submits it, the admin approves it with a
 * category, publishes an interest table on the partner's table and menu, and runs
 * bookings through the escrow (held, captured, released, refunded).
 *
 * Runs against a fresh install (`npm run reset-data` in Backend). On an install
 * that already has an approved restaurant, the steps that only apply to a draft
 * are skipped and the existing data is used.
 */
setup('seed a restaurant journey', async () => {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  const A = await adminToken()
  const P = await partnerToken()
  const R = `${PARTNER_API}/restaurant`

  let restaurant = unwrap(await ok('GET', R, P))
  const draft = ['DRAFT', 'DECLINED', 'REJECTED'].includes(String(restaurant.status ?? restaurant.onboardingStatus).toUpperCase())

  if (draft) {
    await ok('PATCH', R, P, {
      name: 'Kolachi Seafront',
      cuisine: 'Pakistani',
      description: 'Seafront barbecue on Do Darya with a view of the Arabian Sea.',
      location: { areaDistrict: 'DHA Phase 8', city: 'Karachi', fullAddress: 'Do Darya, DHA Phase 8, Karachi', latitude: 24.7841, longitude: 67.0647 },
      owner: { name: 'Raees Khan', email: 'owner@kolachi.pk', phone: '+923001112233' },
      restaurant: { phone: '+922135250000', email: 'hello@kolachi.pk' },
    })
    const target = unwrap(await ok('POST', `${R}/photos/upload-url`, P, { name: 'dining.jpg', contentType: 'image/jpeg' }))
    const put = await fetch(new URL(target.uploadUrl, ADMIN_API).toString(), {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: fs.readFileSync(new URL('./fixtures/dining.jpg', import.meta.url)),
    })
    expect(put.status, 'photo upload').toBeLessThan(300)
    await ok('POST', `${R}/photos`, P, { uploadRef: target.uploadRef })
    await ok('PUT', `${R}/payout-account`, P, { accountTitle: 'Kolachi Seafront Pvt Ltd', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' })
    const courses = [{ course: 'Main Course', choose: 1, options: ['Chicken Biryani', 'Lamb Tikka'] }]
    await ok('POST', `${R}/tables`, P, { name: 'Window Table', availability: { '5': [{ start: '18:00', end: '23:00' }] } })
    await ok('POST', `${R}/tables`, P, { name: 'Garden Patio' })
    await ok('POST', `${R}/menu-options`, P, { name: 'Signature Set', pricePkr: 3500, courses })
    await ok('POST', `${R}/menu-options`, P, { name: 'Seafood Set', pricePkr: 4200, courses })
    await ok('POST', `${R}/submit`, P)
  }
  restaurant = unwrap(await ok('GET', R, P))
  const rid = restaurant.id as string

  // Category, then approval
  let category = itemsOf(await ok('GET', `${ADMIN_API}/categories`, A)).find((c) => c.name === 'Premium')
  if (!category) category = unwrap(await ok('POST', `${ADMIN_API}/categories`, A, { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 4 }))
  const categoryId = category.id
  const waiting = itemsOf(await ok('GET', `${ADMIN_API}/admin/approvals`, A)).some((x) => x.id === rid)
  if (waiting) await ok('POST', `${ADMIN_API}/admin/approvals/${rid}/approve`, A, { categoryId })

  // Interest table on the partner's own table and menus
  const tables = itemsOf(await ok('GET', `${R}/tables`, P))
  const menus = itemsOf(await ok('GET', `${R}/menu-options`, P))
  const topics = itemsOf(await ok('GET', `${ADMIN_API}/topics`, A))
  let it = itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${rid}/interest-tables`, A)).find((x) => x.name === 'Startup Mixer')
  if (!it) {
    const created = await call('POST', `${ADMIN_API}/restaurants/${rid}/interest-tables`, A, {
      name: 'Startup Mixer',
      maxGuests: 8,
      startDate: nextFriday(),
      startTime: '19:30',
      durationMinutes: 150,
      availabilityMode: 'AVAILABLE_NOW',
      publish: true,
      topicId: topics[0]?.id,
      restaurantTableId: tables[0]?.id,
      menuOptionIds: menus.map((m) => m.id),
    })
    expect(created.status, JSON.stringify(created.json)).toBe(201)
    it = unwrap(created.json)
  }

  // Bookings through the escrow: held, captured, released, refunded
  const E = `${ADMIN_API}/escrow`
  const existing = itemsOf(await ok('GET', E, A))
  if (existing.length < 4) {
    const book = async (minglerName: string, guests: number, amountPerGuest: number) =>
      unwrap(await ok('POST', `${E}/test-booking`, A, { restaurantId: rid, minglerName, guests, amountPerGuest, eventName: 'Startup Mixer' })).id as string
    const held = await book('Sana Khan', 4, 3500)
    const captured = await book('Osama Siddiqui', 2, 4200)
    const released = await book('Hina Baig', 3, 3500)
    const refunded = await book('Ali Raza', 1, 4200)
    void held
    await ok('POST', `${E}/${captured}/capture`, A)
    await ok('POST', `${E}/${released}/capture`, A)
    await ok('POST', `${E}/${released}/release`, A)
    await ok('POST', `${E}/${refunded}/capture`, A)
    await ok('POST', `${E}/${refunded}/refund`, A, { reason: 'Guest was unwell' })
  }

  fs.writeFileSync(
    SEED_FILE,
    JSON.stringify({ restaurantId: rid, restaurantName: restaurant.name, categoryId, interestTableId: it.id, at: new Date().toISOString() }, null, 2),
  )
})

setup('sign in to both portals', async ({ browser }) => {
  for (const [url, who, file] of [
    [ADMIN_URL, ADMIN, ADMIN_STORAGE],
    [PARTNER_URL, PARTNER, PARTNER_STORAGE],
  ] as const) {
    const context = await browser.newContext()
    const page = await context.newPage()
    await page.goto(`${url}/login`)
    await page.locator('input[type=email], input[name=email]').first().fill(who.email)
    await page.locator('input[type=password]').first().fill(who.password)
    await page.locator('button[type=submit]').first().click()
    await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
    await context.storageState({ path: file })
    await context.close()
  }
})

/** A Friday at least a week away, as YYYY-MM-DD. */
function nextFriday(): string {
  const d = new Date(Date.now() + 7 * 86_400_000)
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

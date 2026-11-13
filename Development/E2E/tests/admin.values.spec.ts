import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { ADMIN_API, adminToken, grouped, itemsOf, ok, unwrap } from './support/api'
import { API_URL, SEED_FILE } from './support/env'
import { screenText, settle } from './support/page-checks'

/**
 * The Admin Panel shows exactly what the API holds: each value is read from the
 * API first, then looked for on the screen that displays it.
 */
/** "2026-11-13" -> "13-11-2026", the portal's usual date format. */
const dmy = (iso: string) => iso.split('-').reverse().join('-')
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
let A = ''
test.beforeAll(async () => {
  A = await adminToken()
})

test('restaurant list and detail match the API', async ({ page }) => {
  const { restaurantId } = seed()
  const row = itemsOf(await ok('GET', `${ADMIN_API}/restaurants`, A)).find((r) => r.id === restaurantId)
  const detail = unwrap(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}`, A))

  await page.goto('/restaurants')
  await settle(page)
  let text = await screenText(page)
  for (const v of [row.name, row.cuisine, row.city, row.category.name, dmy(row.joinedAt), String(row.confirmedBookings)]) expect(text, `list shows ${v}`).toContain(v)
  expect(text).toMatch(/Active/)

  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)
  text = await screenText(page)
  for (const v of [detail.name, detail.description, detail.category.name, detail.cuisine, detail.fullAddress, detail.areaDistrict, detail.city, detail.phone, detail.ownerName, detail.ownerEmail, detail.ownerPhone]) {
    expect(text, `detail shows ${v}`).toContain(v)
  }
  // The restaurant's own email, not the owner's, under Location & Address.
  if (detail.email) expect(text).toContain(detail.email)

  // Tables and menu options the partner added
  await page.getByRole('tab', { name: /Menu Options/i }).click()
  await settle(page)
  text = await screenText(page)
  for (const m of itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/menu-options`, A))) {
    await expect(page.locator('body'), `menu ${m.name}`).toContainText(m.name)
    const price = m.pricePkr ?? m.price
    if (typeof price === 'number') expect(text, `menu price ${price}`).toContain(grouped(price))
  }
  await page.getByRole('tab', { name: /Table Timings/i }).click()
  await settle(page)
  text = await screenText(page)
  for (const t of itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/tables`, A))) await expect(page.locator('body'), `table ${t.name}`).toContainText(t.name)
})

test('finances list matches the API to the rupee', async ({ page }) => {
  const items = itemsOf(await ok('GET', `${ADMIN_API}/admin/finances`, A))
  expect(items.length).toBeGreaterThan(0)
  await page.goto('/finances')
  await settle(page)
  const text = await screenText(page)
  for (const f of items) {
    expect(text, f.bookingRef).toContain(f.bookingRef)
    expect(text, `${f.bookingRef} mingler`).toContain(f.mingler.name)
    expect(text, `${f.bookingRef} total`).toContain(`PKR ${grouped(f.totalAmountPkr)}`)
    expect(text, `${f.bookingRef} partner share`).toContain(`PKR ${grouped(f.partnerSharePkr)}`)
  }
})

test('escrow summary and rows match the API', async ({ page }) => {
  const escrow = unwrap(await ok('GET', `${ADMIN_API}/escrow`, A))
  await page.goto('/finances/escrow')
  await settle(page)
  const text = await screenText(page)
  const s = escrow.summary
  for (const [label, amount] of [
    ['held', s.authorized],
    ['in escrow', s.inEscrow],
    ['released', s.released],
    ['refunded', s.refunded],
    ['fees', s.platformFees],
  ] as const) {
    expect(text, `summary ${label}`).toContain(`PKR ${grouped(amount)}`)
  }
  expect(text).toContain(`${s.count} transactions`)
  for (const item of escrow.items) {
    expect(text, item.bookingRef).toContain(item.bookingRef)
    expect(text, `${item.bookingRef} amount`).toContain(`PKR ${grouped(item.amount)}`)
  }
})

test('interest tables, categories and users match the API', async ({ page }) => {
  const its = itemsOf(await ok('GET', `${ADMIN_API}/interest-tables`, A))
  await page.goto('/interest-tables')
  await settle(page)
  let text = await screenText(page)
  for (const it of its) expect(text, `interest table ${it.name ?? it.interestTableName}`).toContain(it.name ?? it.interestTableName)

  const cats = itemsOf(await ok('GET', `${ADMIN_API}/categories`, A))
  await page.goto('/categories')
  await settle(page)
  text = await screenText(page)
  for (const c of cats) {
    expect(text, c.name).toContain(c.name)
    expect(text, `${c.name} commission`).toContain(`${c.commissionRate}%`)
  }

  const users = itemsOf(await ok('GET', `${ADMIN_API}/users`, A))
  await page.goto('/users')
  await settle(page)
  text = await screenText(page)
  for (const u of users) expect(text, u.email).toContain(u.email)
})

test('unread notifications badge matches the API', async ({ page }) => {
  const r = await ok('GET', `${ADMIN_API}/notifications/unread-count`, A)
  const count = Number(r.data?.count ?? r.data?.unreadCount ?? r.count ?? r.unreadCount ?? r.data)
  await page.goto('/restaurants')
  await settle(page)
  // The bell's badge sits in the top bar, next to the signed-in admin's name.
  const bar = await page.locator('header').first().innerText()
  if (count > 0) expect(bar.replace(/\s+/g, ' ')).toContain(` ${Math.min(count, 99)} `)
  expect(API_URL).toBeTruthy()
})

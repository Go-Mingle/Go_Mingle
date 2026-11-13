import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { ADMIN_API, PARTNER_API, adminToken, grouped, itemsOf, ok, partnerToken, unwrap } from './support/api'
import { SEED_FILE } from './support/env'
import { screenText, settle } from './support/page-checks'

/**
 * The Partner Portal shows what the API holds, and the same restaurant reads the
 * same on both portals.
 */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
let P = ''
let A = ''
test.beforeAll(async () => {
  P = await partnerToken()
  A = await adminToken()
})

/** "+923001112233" -> "+92 300 111 2233", how both portals print Pakistani numbers. */
const phone = (raw: string) =>
  /^\+923/.test(raw) ? raw.replace(/^\+92(\d{3})(\d{3})(\d{4})$/, '+92 $1 $2 $3') : raw.replace(/^\+92(\d{2})(\d{4})(\d{4})$/, '+92 $1 $2 $3')

test('restaurant profile matches the API and the Admin Panel', async ({ page }) => {
  const r = unwrap(await ok('GET', `${PARTNER_API}/restaurant`, P))
  const admin = unwrap(await ok('GET', `${ADMIN_API}/restaurants/${seed().restaurantId}`, A))
  // Same restaurant, same facts, whichever portal you ask.
  expect(admin.name).toBe(r.name)
  expect(admin.description).toBe(r.description)
  expect(admin.fullAddress).toBe(r.location.fullAddress)
  expect(admin.category.name).toBe(r.category.name)
  expect(admin.email).toBe(r.restaurant.email ?? '')
  expect(admin.ownerEmail).toBe(r.owner.email)

  await page.goto('/overview')
  await settle(page)
  const text = await screenText(page)
  for (const v of [r.name, r.description, r.cuisine, r.location.fullAddress, r.location.areaDistrict, r.location.city, r.owner.name, r.owner.email, r.restaurant.email]) {
    expect(text, `overview shows ${v}`).toContain(v)
  }
  expect(text).toContain(`${r.commissionPercent}% commission`)
  expect(text).toContain(phone(r.restaurant.phone))
  expect(text).toContain(phone(r.owner.phone))
})

test('menu options and tables match the API', async ({ page }) => {
  await page.goto('/overview')
  await settle(page)
  await page.getByRole('tab', { name: /Menu Options/i }).click()
  await settle(page)
  let text = await screenText(page)
  for (const m of itemsOf(await ok('GET', `${PARTNER_API}/restaurant/menu-options`, P))) {
    await expect(page.locator('body'), m.name).toContainText(m.name)
    expect(text, `${m.name} price`).toContain(grouped(m.pricePkr))
  }
  await page.getByRole('tab', { name: /Table Timings/i }).click()
  await settle(page)
  text = await screenText(page)
  for (const t of itemsOf(await ok('GET', `${PARTNER_API}/restaurant/tables`, P))) await expect(page.locator('body'), t.name).toContainText(t.name)
})

test('interest tables match the API and the Admin Panel', async ({ page }) => {
  const mine = itemsOf(await ok('GET', `${PARTNER_API}/interest-tables`, P))
  const adminSide = itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${seed().restaurantId}/interest-tables`, A))
  expect(mine.map((x) => x.name).sort()).toEqual(adminSide.map((x) => x.name ?? x.interestTableName).sort())

  await page.goto('/overview')
  await settle(page)
  await page.getByRole('tab', { name: /Interest Tables/i }).click()
  await settle(page)
  const text = await screenText(page)
  for (const it of mine) {
    await expect(page.locator('body'), it.name).toContainText(it.name)
    expect(text, `${it.name} date`).toContain(it.date)
    expect(text, `${it.name} time`).toContain(it.time)
  }
})

test('finances and escrow match the API and the Admin Panel', async ({ page }) => {
  const escrow = unwrap(await ok('GET', `${PARTNER_API}/escrow`, P))
  const adminEscrow = unwrap(await ok('GET', `${ADMIN_API}/escrow`, A))
  // One restaurant on the platform: both portals must agree on every total.
  expect(escrow.summary).toEqual(adminEscrow.summary)

  await page.goto('/finances')
  await settle(page)
  const text = await screenText(page)
  for (const amount of [escrow.summary.authorized, escrow.summary.inEscrow, escrow.summary.released]) expect(text).toContain(`PKR ${grouped(amount)}`)
  expect(text).toContain(`${escrow.summary.platformFeePct}% GoMingle fee`)
  expect(text).toContain(escrow.payoutAccount.iban)

  const adminRows = itemsOf(await ok('GET', `${ADMIN_API}/admin/finances`, A))
  for (const f of adminRows) {
    expect(text, f.bookingRef).toContain(f.bookingRef)
    expect(text, `${f.bookingRef} my share`).toContain(`PKR ${grouped(f.partnerSharePkr)}`)
    expect(text, `${f.bookingRef} total`).toContain(`PKR ${grouped(f.totalAmountPkr)}`)
  }
  // Last payout date in the portal's usual DD-MM-YYYY
  if (/Last payout/.test(text)) expect(text).toMatch(/Last payout [^:]+: PKR [\d,]+ on \d{2}-\d{2}-\d{4}/)
})

test('team list matches the API', async ({ page }) => {
  const users = itemsOf(await ok('GET', `${PARTNER_API}/users`, P))
  await page.goto('/users')
  await settle(page)
  const text = await screenText(page)
  for (const u of users) {
    const name = u.fullName ?? u.name
    expect(text, name).toContain(name)
  }
})

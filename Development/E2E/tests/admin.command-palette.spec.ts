import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { ADMIN_API, ok, adminToken, unwrap } from './support/api'
import { SEED_FILE } from './support/env'
import { settle, watch } from './support/page-checks'

/**
 * Global search (GM-344): Ctrl+K from any page finds pages, restaurants,
 * bookings by reference and admin users, and opens them with the keyboard.
 */
const seed = () =>
  JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as {
    restaurantId: string
    restaurantName: string
    interestTableId: string
  }
const SHOTS = process.env.GM_SHOTS

test('Ctrl+K opens search and jumps to a page', async ({ page }) => {
  const w = watch(page)
  await page.goto('/restaurants')
  await settle(page)
  await page.keyboard.press('Control+k')
  const input = page.getByTestId('command-input')
  await expect(input).toBeFocused()
  await input.fill('payouts')
  await expect(page.getByRole('option', { name: /Finances/ })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/finances$/)
  expect(w.errors).toEqual([])
})

test('finds a restaurant by name and opens it', async ({ page }) => {
  const { restaurantId, restaurantName } = seed()
  await page.goto('/dashboard')
  await settle(page)
  await page.getByTestId('command-trigger').click()
  await page.getByTestId('command-input').fill(restaurantName.slice(0, 5))
  const hit = page.getByTestId(`command-item-restaurant-${restaurantId}`)
  await expect(hit).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/command-restaurant.png` })
  await hit.click()
  await expect(page).toHaveURL(new RegExp(`/restaurants/${restaurantId}$`))

  // It is now a recent item.
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('option', { name: new RegExp(restaurantName) })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('command-input')).toHaveCount(0)
})

test('finds a booking by its reference', async ({ page }) => {
  const { interestTableId } = seed()
  const A = await adminToken()
  const made = unwrap(await ok('POST', `${ADMIN_API}/admin/bookings/sandbox`, A, { interestTableId, minglerName: 'Search Check', seats: 1 }))
  const booking = (made.booking ?? made) as { id: string; bookingRef: string }
  try {
    await page.goto('/dashboard')
    await settle(page)
    await page.keyboard.press('Control+k')
    // Typed loosely: lower case, no dash.
    await page.getByTestId('command-input').fill(booking.bookingRef.replace('-', '').toLowerCase())
    await page.getByRole('option', { name: new RegExp(booking.bookingRef) }).click()
    await expect(page).toHaveURL(new RegExp(`/interest-tables/${interestTableId}\\?tab=bookings`))
  } finally {
    await ok('POST', `${ADMIN_API}/admin/bookings/${booking.id}/cancel`, A).catch(() => undefined)
  }
})

test('finds an admin user and opens their details', async ({ page }) => {
  const A = await adminToken()
  const roles = unwrap(await ok('GET', `${ADMIN_API}/roles/active`, A))
  const roleId = ((roles.items ?? roles) as { id: string }[])[0].id
  const stamp = Date.now().toString(36)
  const fullName = `Mehwish Search ${stamp}`
  const created = unwrap(
    await ok('POST', `${ADMIN_API}/users`, A, {
      fullName,
      email: `mehwish.${stamp}@gomingle.pk`,
      roleId,
      password: 'Search!2026pass',
      confirmPassword: 'Search!2026pass',
    }),
  ) as { id: string }
  try {
    await page.goto('/dashboard')
    await settle(page)
    await page.keyboard.press('Control+k')
    await page.getByTestId('command-input').fill(`search ${stamp}`)
    await page.getByTestId(`command-item-user-${created.id}`).click()
    await expect(page).toHaveURL(/\/users$/)
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox').first()).toHaveValue(fullName)
  } finally {
    await ok('DELETE', `${ADMIN_API}/users/${created.id}`, A).catch(() => undefined)
  }
})

test('search works on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard')
  await settle(page)
  await page.getByTestId('command-trigger').click()
  await page.getByTestId('command-input').fill('amen')
  await expect(page.getByRole('option', { name: /Amenities/ })).toBeVisible()
  const box = await page.locator('.gm-command .ant-modal-container').boundingBox()
  expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/command-phone.png` })
})

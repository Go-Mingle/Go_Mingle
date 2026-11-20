import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_API, PARTNER_API, ok, adminToken, partnerToken, unwrap } from './support/api'
import { SEED_FILE } from './support/env'
import { settle, watch } from './support/page-checks'

/**
 * A super admin manages a restaurant on its behalf from the Admin Panel
 * (GM-342): edits details, tables and amenities, archives and restores it, and
 * every change shows in the change log. Each step is undone, so the restaurant
 * is left as the other specs expect it.
 */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as { restaurantId: string }
const stamp = Date.now().toString(36)
const SHOTS = process.env.GM_SHOTS

async function openManage(page: Page, item: string | RegExp) {
  await page.getByTestId('manage-restaurant').first().click()
  await page.getByRole('menuitem', { name: item }).click()
}

test('edits the restaurant details on its behalf, and the restaurant sees the change', async ({ page }) => {
  const { restaurantId } = seed()
  const P = await partnerToken()
  const before = unwrap(await ok('GET', `${PARTNER_API}/restaurant`, P)).description as string
  const w = watch(page)
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)
  await openManage(page, 'Edit details')
  const drawer = page.getByRole('dialog')
  await expect(drawer.getByText(/on the restaurant's behalf/)).toBeVisible()
  const description = drawer.getByLabel('Description')
  await expect(description).toHaveValue(before)
  await description.fill(`${before} (${stamp})`)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/manage-details.png` })
  await page.getByTestId('manage-details-save').click()
  await expect(page.getByText('Saved')).toBeVisible()
  expect(unwrap(await ok('GET', `${PARTNER_API}/restaurant`, P)).description).toBe(`${before} (${stamp})`)
  // Put it back.
  await ok('PATCH', `${PARTNER_API}/restaurant`, P, { description: before })
  expect(w.errors).toEqual([])
})

test('adds, hides and removes a table area, and the change log names it', async ({ page }) => {
  const { restaurantId } = seed()
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)
  await openManage(page, 'Tables')
  const drawer = page.getByRole('dialog')
  await drawer.getByRole('button', { name: 'Add table' }).click()
  await drawer.getByLabel('Table area name').fill(`Rooftop ${stamp}`)
  await drawer.getByRole('button', { name: 'Save' }).click()
  const row = drawer.getByTestId(`manage-table-Rooftop ${stamp}`)
  await expect(drawer.getByText(`Rooftop ${stamp}`)).toBeVisible()
  await row.getByRole('button', { name: 'Hide' }).click()
  await expect(drawer.getByText('Hidden').first()).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/manage-tables.png` })
  await row.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).last().click()
  await expect(drawer.getByText(`Rooftop ${stamp}`)).toHaveCount(0)

  const A = await adminToken()
  const log = (await ok('GET', `${ADMIN_API}/change-log`, A)) as { newVal: string; module: string }[]
  const mine = log.filter((l) => l.newVal.includes(`Rooftop ${stamp}`))
  expect(mine.map((l) => l.newVal.split(':')[0])).toEqual(expect.arrayContaining(['Added table', 'Hid table', 'Removed table']))
  expect(mine.every((l) => l.module === 'Restaurants')).toBe(true)
})

test('ticks and unticks an amenity for the restaurant', async ({ page }) => {
  const { restaurantId } = seed()
  const name = 'Sea view'
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)
  await openManage(page, 'Amenities')
  const drawer = page.getByRole('dialog')
  const box = drawer.getByRole('checkbox', { name })
  await box.check()
  await expect(box).toBeChecked()
  const P = await partnerToken()
  const selected = () => ok('GET', `${PARTNER_API}/restaurant/amenities`, P).then((j) => (unwrap(j).items as { name: string; selected: boolean }[]).find((a) => a.name === name)?.selected)
  await expect.poll(selected).toBe(true)
  await box.uncheck()
  await expect.poll(selected).toBe(false)
})

test('archives a restaurant with a reason and restores it', async ({ page }) => {
  const { restaurantId } = seed()
  const A = await adminToken()
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)
  await openManage(page, 'Archive restaurant')
  const confirm = page.getByRole('button', { name: 'Archive', exact: true })
  await expect(confirm).toBeDisabled()
  await page.getByLabel(/Why is it being archived/).fill('Closed for renovation until spring.')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/manage-archive.png` })
  await confirm.click()
  await expect(page.getByText('Archived').first()).toBeVisible()
  const listed = (unwrap(await ok('GET', `${ADMIN_API}/restaurants`, A)).items as { id: string }[]).map((r) => r.id)
  expect(listed).not.toContain(restaurantId)

  await openManage(page, 'Restore from archive')
  await expect(page.getByText(/was restored/)).toBeVisible()
  const detail = unwrap(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}`, A))
  expect(detail.status).toBe('ACTIVE')
  // Archiving hid it from the app; turn visibility back on as it was.
  const P = await partnerToken()
  await ok('PATCH', `${PARTNER_API}/restaurant`, P, { visibleOnApp: true }).catch(() => undefined)
})

test('timer settings list the platform timers', async ({ page }) => {
  await page.goto('/timer-settings')
  await settle(page)
  await expect(page.getByRole('heading', { name: 'Bookings' })).toBeVisible()
  await expect(page.getByTestId('timer-auto-cancel')).toContainText('4 hours')
  await expect(page.getByTestId('timer-check-in-opens')).toContainText('60 minutes')
})

test('messages every restaurant, and the restaurant receives it', async ({ page }) => {
  await page.goto('/notifications')
  await settle(page)
  await page.getByRole('button', { name: 'Message restaurants' }).click()
  await page.getByLabel('Title', { exact: true }).fill(`Eid timings ${stamp}`)
  await page.getByLabel('Message', { exact: true }).fill('Bookings close at 6 PM on Eid.')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText(/Sent to \d+ restaurant/)).toBeVisible()
  const P = await partnerToken()
  const inbox = unwrap(await ok('GET', `${PARTNER_API}/notifications`, P)).items as { title: string; type: string }[]
  expect(inbox.some((n) => n.title === `Eid timings ${stamp}` && n.type === 'GOMINGLE_ANNOUNCEMENT')).toBe(true)
})

test('uploads a photo for the restaurant and removes it', async ({ page }) => {
  const { restaurantId } = seed()
  const P = await partnerToken()
  const count = async () => (unwrap(await ok('GET', `${PARTNER_API}/restaurant/media`, P)).photos.items as unknown[]).length
  const before = await count()
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)
  await openManage(page, 'Photos')
  const drawer = page.getByRole('dialog')
  await drawer.locator('input[type=file]').setInputFiles(new URL('./fixtures/dining.jpg', import.meta.url).pathname)
  await expect.poll(count).toBe(before + 1)
  await expect(drawer.locator('figure')).toHaveCount(before + 1)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/manage-photos.png` })
  await drawer.locator('figure').last().getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('button', { name: 'Delete' }).last().click()
  await expect.poll(count).toBe(before)
})

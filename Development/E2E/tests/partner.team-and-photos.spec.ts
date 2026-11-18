import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { PARTNER_API, ok, partnerToken, unwrap } from './support/api'
import { PARTNER_URL, SEED_FILE } from './support/env'
import { settle, watch } from './support/page-checks'

/**
 * Users: everyone on the team sees who is on it, only owners change it
 * (GM-317, GM-318). Photos: the cover and the profile picture are chosen and
 * cropped separately (GM-320).
 */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
const stamp = Date.now().toString(36)
const PASSWORD = 'Kolachi@2026'

test('a team member sees the team read-only: name, role, designation and email', async ({ browser }) => {
  const P = await partnerToken()
  const email = `waiter-${stamp}@kolachi.pk`
  await ok('POST', `${PARTNER_API}/users`, P, { fullName: 'Hamza Waiter', email, designation: 'Head Waiter', password: PASSWORD, confirmPassword: PASSWORD })

  // A fresh browser, signed in as the team member.
  const context = await browser.newContext({ baseURL: PARTNER_URL, storageState: { cookies: [], origins: [] } })
  const page = await context.newPage()
  const w = watch(page)
  await page.goto('/login')
  await page.locator('input[type=email], input[name=email]').first().fill(email)
  await page.locator('input[type=password]').first().fill(PASSWORD)
  await page.locator('button[type=submit]').first().click()
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 })
  await page.goto('/users')
  await settle(page)

  const owner = unwrap(await ok('GET', `${PARTNER_API}/me`, P))
  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()
  await expect(page.getByText("Everyone who can sign in to this restaurant's portal.")).toBeVisible()
  await expect(page.getByRole('link', { name: owner.email })).toBeVisible()
  await expect(page.getByRole('link', { name: email })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: email }).getByText('Head Waiter')).toBeVisible()
  await expect(page.getByText('Owner').first()).toBeVisible()
  // Nothing to change from here.
  await expect(page.getByRole('button', { name: /new user/i })).toHaveCount(0)
  await expect(page.getByText('Only the account owner can manage this')).toHaveCount(0)
  expect(w.errors).toEqual([])
  expect(w.failedCalls).toEqual([])
  await context.close()
})

test('the owner sees the Owner badge and every email on the Users page', async ({ page }) => {
  const P = await partnerToken()
  const owner = unwrap(await ok('GET', `${PARTNER_API}/me`, P))
  await page.goto('/users')
  await settle(page)
  await expect(page.getByRole('button', { name: /new user/i })).toBeVisible()
  const row = page.getByRole('row').filter({ hasText: owner.email })
  // The crown badge; the designation column may say Owner too.
  await expect(row.locator('span.rounded-full', { hasText: 'Owner' })).toBeVisible()
})

test('crops a profile photo in the browser and shows it in the header, apart from the cover', async ({ page }) => {
  const { restaurantId } = seed()
  const P = await partnerToken()
  const w = watch(page)
  await page.goto('/overview')
  await settle(page)
  await page.getByRole('tab', { name: /photos/i }).click()
  await settle(page)

  const gallery = unwrap(await ok('GET', `${PARTNER_API}/restaurant/media`, P))
  const photo = gallery.photos.items[0]
  const card = page.locator('div.overflow-hidden').filter({ has: page.getByAltText(photo.name) }).first()
  await card.hover()
  await card.getByRole('button', { name: /set as profile photo|adjust profile photo/i }).click()

  const dialog = page.getByRole('dialog', { name: 'Profile photo' })
  await expect(dialog).toBeVisible()
  await expect(dialog.locator('.reactEasyCrop_CropAreaRound')).toBeVisible()
  // Zoom in a little, then save: the browser cuts the circle out and uploads it.
  await dialog.getByRole('slider', { name: 'Zoom' }).focus()
  await page.keyboard.press('ArrowRight')
  await dialog.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Profile photo updated.')).toBeVisible()

  const profile = unwrap(await ok('GET', `${PARTNER_API}/restaurant`, P))
  expect(profile.profilePhotoUrl).toMatch(new RegExp(`/t/${restaurantId}/mock-cdn/crop-\\d+\\.jpg$`))
  expect(profile.profilePhotoUrl).not.toBe(profile.coverPhotoUrl)
  // The cut image is a real JPEG, not the placeholder.
  const served = await page.request.get(profile.profilePhotoUrl)
  expect(served.headers()['content-type']).toBe('image/jpeg')
  const roles = unwrap(await ok('GET', `${PARTNER_API}/restaurant/photo-roles`, P))
  expect(roles.profile.mediaId).toBe(photo.mediaId)
  expect(roles.profile.crop.width).toBeGreaterThan(0)
  expect(roles.profile.crop.width).toBeLessThanOrEqual(1)

  await expect(card.getByText('Profile photo')).toBeVisible()
  await expect(page.getByTestId('profile-photo')).toHaveAttribute('src', profile.profilePhotoUrl)
  expect(w.errors).toEqual([])
  expect(w.failedCalls).toEqual([])
})

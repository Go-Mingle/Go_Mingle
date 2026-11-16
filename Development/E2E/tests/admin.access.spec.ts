import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { ADMIN_API, PARTNER_API, adminToken, call, itemsOf, ok, unwrap } from './support/api'
import { SEED_FILE } from './support/env'
import { settle, watch } from './support/page-checks'

/**
 * A GoMingle admin creates a restaurant profile from the Admin Panel; the owner
 * gets in with that email and finds the profile waiting. Also: who can sign in
 * to a restaurant, and giving another email access (GM-308, GM-309).
 */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
const stamp = Date.now().toString(36)

test('admin adds a restaurant; it waits for its owner, who finds it on sign-up', async ({ page }) => {
  const name = `Lal Qila ${stamp}`
  const ownerEmail = `bilal-${stamp}@lalqila.pk`
  const w = watch(page)
  await page.goto('/restaurants')
  await settle(page)

  await page.getByRole('button', { name: 'Add restaurant' }).click()
  const dialog = page.getByRole('dialog')
  // The form checks itself before anything is sent.
  await dialog.getByRole('button', { name: 'Create and email the owner' }).click()
  await expect(dialog.getByText('Enter the restaurant name.')).toBeVisible()
  await dialog.getByLabel('Restaurant name').fill(name)
  await dialog.getByLabel("Owner's name").fill('Bilal Khan')
  await dialog.getByLabel("Owner's email").fill(ownerEmail)
  await dialog.getByRole('button', { name: 'Create and email the owner' }).click()
  await expect(page.getByText(`${name} created.`, { exact: false })).toBeVisible()

  const waiting = page.getByRole('region', { name: 'Waiting for the owner' })
  await expect(waiting.getByText(name)).toBeVisible()
  await expect(waiting.getByText(ownerEmail)).toBeVisible()
  await expect(waiting.getByText("Owner hasn't signed in").first()).toBeVisible()

  // The API agrees, and the profile is in neither the directory nor the approval queue.
  const A = await adminToken()
  const invited = itemsOf(await ok('GET', `${ADMIN_API}/restaurants/invited`, A)).find((r) => r.name === name)
  expect(invited).toMatchObject({ ownerEmail, ownerName: 'Bilal Khan', ownerSignedIn: false })
  expect(JSON.stringify(await ok('GET', `${ADMIN_API}/restaurants`, A))).not.toContain(name)
  expect(JSON.stringify(await ok('GET', `${ADMIN_API}/admin/approvals`, A))).not.toContain(name)

  // The same owner cannot be given a second restaurant.
  await page.getByRole('button', { name: 'Add restaurant' }).click()
  await dialog.getByLabel('Restaurant name').fill(`Second ${stamp}`)
  await dialog.getByLabel("Owner's name").fill('Bilal Khan')
  await dialog.getByLabel("Owner's email").fill(ownerEmail)
  await dialog.getByRole('button', { name: 'Create and email the owner' }).click()
  await expect(dialog.getByText(/One email can sign in to one restaurant/)).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()

  // The owner signs up with that email (the local API accepts the demo code) and lands on the profile.
  expect((await call('POST', `${PARTNER_API}/signup/start`, undefined, { email: ownerEmail })).status).toBe(200)
  const verified = await call('POST', `${PARTNER_API}/signup/verify`, undefined, { email: ownerEmail, code: '123456' })
  expect(verified.status).toBe(201)
  expect(verified.json.data.restaurant.id).toBe(invited.id)
  const mine = unwrap(await ok('GET', `${PARTNER_API}/restaurant`, verified.json.data.session.accessToken))
  expect(mine).toMatchObject({ name, status: 'DRAFT', owner: { name: 'Bilal Khan', email: ownerEmail } })

  // Expected 409 above; nothing else may fail.
  expect(w.errors).toEqual([])
  expect(w.failedCalls.filter((c) => !/POST \/admin\/api\/v1\/restaurants -> 409/.test(c))).toEqual([])
})

test('admin resends and cancels a waiting profile', async ({ page }) => {
  const name = `Typo Cafe ${stamp}`
  const A = await adminToken()
  await ok('POST', `${ADMIN_API}/restaurants`, A, { name, ownerName: 'Wrong Person', ownerEmail: `wrnog-${stamp}@typo.pk` })
  await page.goto('/restaurants')
  await settle(page)
  const row = page.getByRole('region', { name: 'Waiting for the owner' }).getByRole('row').filter({ hasText: name })
  await row.getByRole('button', { name: 'Resend email' }).click()
  await expect(page.getByText(`Email sent again to wrnog-${stamp}@typo.pk.`)).toBeVisible()
  await row.getByRole('button', { name: `Cancel ${name}` }).click()
  await page.getByRole('button', { name: 'Cancel profile' }).click()
  await expect(page.getByText(`${name} cancelled.`)).toBeVisible()
  await expect(row).toHaveCount(0)
  expect(itemsOf(await ok('GET', `${ADMIN_API}/restaurants/invited`, A)).map((r) => r.name)).not.toContain(name)
})

test('restaurant detail shows who can sign in, and gives another email access', async ({ page }) => {
  const { restaurantId, restaurantName } = seed()
  const A = await adminToken()
  const email = `manager-${stamp}@gmail.com`
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)

  const logins = itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/logins`, A))
  expect(logins.length).toBeGreaterThan(0)
  for (const l of logins) await expect(page.getByText(l.email, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Partner Portal access')).toBeVisible()

  await page.getByRole('button', { name: 'Give access' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Name').fill('New Manager')
  await dialog.getByLabel('Email').fill(email)
  await dialog.getByRole('button', { name: 'Give access' }).click()
  await expect(page.getByText(`Access given. We emailed ${email}.`)).toBeVisible()
  await expect(page.getByText(email, { exact: true })).toBeVisible()
  await expect(page.getByText("Hasn't signed in yet")).toBeVisible()

  // That person signs up with the email and lands on this restaurant, not a new one.
  await call('POST', `${PARTNER_API}/signup/start`, undefined, { email })
  const verified = await call('POST', `${PARTNER_API}/signup/verify`, undefined, { email, code: '123456' })
  expect(verified.json.data.restaurant.id).toBe(restaurantId)
  const mine = unwrap(await ok('GET', `${PARTNER_API}/restaurant`, verified.json.data.session.accessToken))
  expect(mine.name).toBe(restaurantName)
})

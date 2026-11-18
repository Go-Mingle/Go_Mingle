import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { ADMIN_API, adminToken, itemsOf, ok } from './support/api'
import { SEED_FILE } from './support/env'
import { settle, watch } from './support/page-checks'

/**
 * A GoMingle admin hands a restaurant to new owners (GM-319). Works only on
 * logins it creates, so the seeded owner the other suites sign in as is never
 * touched.
 */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
const stamp = Date.now().toString(36)

test('admin gives owner access, demotes, suspends and removes it, and the change log says so', async ({ page }) => {
  const { restaurantId } = seed()
  const A = await adminToken()
  const email = `coowner-${stamp}@kolachi.pk`
  const w = watch(page)
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)

  // Give a new email owner access straight away.
  await page.getByRole('button', { name: 'Give access' }).click()
  const give = page.getByRole('dialog')
  await give.getByLabel('Name').fill('Ayesha Malik')
  await give.getByLabel('Email').fill(email)
  await give.getByLabel('Make this person an owner').check()
  await give.getByRole('button', { name: 'Give access' }).click()
  await expect(page.getByText(`Access given. We emailed ${email}.`)).toBeVisible()
  const added = itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/logins`, A)).find((l) => l.email === email)
  expect(added).toMatchObject({ isOwner: true, designation: 'Owner' })
  expect(itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/logins`, A)).filter((l) => l.isOwner).length).toBeGreaterThanOrEqual(2)

  // Make them a team member and suspend them in one edit.
  await page.getByRole('button', { name: 'Edit Ayesha Malik' }).click()
  const edit = page.getByRole('dialog', { name: 'Edit Ayesha Malik' })
  await edit.getByText('Team member', { exact: true }).click()
  await edit.getByRole('switch').click()
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Ayesha Malik updated.')).toBeVisible()
  const edited = itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/logins`, A)).find((l) => l.email === email)
  expect(edited).toMatchObject({ isOwner: false, status: 'SUSPENDED', designation: null })

  // Take access away.
  await page.getByRole('button', { name: 'Remove access for Ayesha Malik' }).click()
  await page.getByRole('dialog', { name: 'Remove access for Ayesha Malik?' }).getByRole('button', { name: 'Remove access' }).click()
  await expect(page.getByText(`Access removed for ${email}.`)).toBeVisible()
  expect(itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/logins`, A)).map((l) => l.email)).not.toContain(email)

  const log = (await ok('GET', `${ADMIN_API}/change-log`, A)) as Array<{ newVal: string }>
  const texts = log.map((e) => e.newVal)
  expect(texts).toContain(`Removed portal access: ${email}`)
  expect(texts).toContain(`Changed portal access for ${email}: made team member, suspended`)
  expect(w.errors).toEqual([])
  expect(w.failedCalls).toEqual([])
})

test('the last active owner cannot be demoted, and the screen says why', async ({ page }) => {
  const { restaurantId } = seed()
  const A = await adminToken()
  const owners = itemsOf(await ok('GET', `${ADMIN_API}/restaurants/${restaurantId}/logins`, A)).filter((l) => l.isOwner && l.status === 'ACTIVE')
  test.skip(owners.length !== 1, 'another owner exists right now')
  const w = watch(page, [/\/logins\//])
  await page.goto(`/restaurants/${restaurantId}`)
  await settle(page)
  await page.getByRole('button', { name: `Edit ${owners[0].fullName}` }).click()
  const edit = page.getByRole('dialog', { name: `Edit ${owners[0].fullName}` })
  await edit.getByText('Team member', { exact: true }).click()
  await edit.getByRole('button', { name: 'Save' }).click()
  await expect(edit.getByText(/needs at least one active owner/)).toBeVisible()
  expect(w.errors).toEqual([])
})

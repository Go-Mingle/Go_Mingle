import { test, expect } from '@playwright/test'
import { PARTNER_API, ok, partnerToken, unwrap } from './support/api'
import { settle, watch } from './support/page-checks'

/**
 * Owners import team users and restaurant contacts from a spreadsheet (GM-339).
 * Rows with problems are shown and skipped; the rest arrive in the lists.
 */
const stamp = Date.now().toString(36)
const PASSWORD = 'Kolachi@2026'
const SHOTS = process.env.GM_SHOTS

const csv = (rows: string[][]) => Buffer.from(rows.map((r) => r.join(',')).join('\n'))

test('imports team users from a CSV, skipping rows with problems', async ({ page }) => {
  const w = watch(page)
  await page.goto('/users')
  await settle(page)
  await page.getByRole('button', { name: /import team users/i }).click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'team.csv',
    mimeType: 'text/csv',
    buffer: csv([
      ['Full name', 'Email', 'Designation', 'Status'],
      ['Ayesha Siddiqui', `ayesha-${stamp}@kolachi.pk`, 'Floor manager', 'Active'],
      ['Bilal Ahmed', `bilal-${stamp}@kolachi.pk`, '', 'Suspended'],
      ['No Email', '', '', ''],
    ]),
  })
  await expect(page.getByText('2 ready to import, 1 with problems')).toBeVisible()
  await expect(page.getByText('Email is missing')).toBeVisible()
  const go = page.getByRole('button', { name: 'Import 2 rows' })
  await expect(go).toBeDisabled()
  await page.getByLabel('Temporary password').fill(PASSWORD)
  await page.getByLabel('Confirm password').fill(PASSWORD)
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-users-preview.png` })
  await go.click()
  await expect(page.getByText('Imported 2. Failed 0. Skipped 1.')).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-users-done.png` })
  await page.getByTestId('import-done').getByRole('button', { name: 'Close' }).click()

  const P = await partnerToken()
  const list = unwrap(await ok('GET', `${PARTNER_API}/users?pageSize=100`, P))
  const emails = (list.items as { email: string; status: string }[])
    .filter((u) => u.email.includes(stamp))
    .map((u) => `${u.email}:${u.status}`)
    .sort()
  expect(emails).toEqual([`ayesha-${stamp}@kolachi.pk:ACTIVE`, `bilal-${stamp}@kolachi.pk:SUSPENDED`])
  await expect(page.getByText(`ayesha-${stamp}@kolachi.pk`)).toBeVisible()
  expect(w.errors).toEqual([])
})

test('imports restaurant contacts from a CSV for the GoMingle team to see', async ({ page }) => {
  const w = watch(page)
  await page.goto('/')
  await settle(page)
  await page.getByRole('tab', { name: 'Contacts' }).click()
  await page.getByRole('button', { name: 'Import' }).first().click()
  await page.locator('input[type=file]').setInputFiles({
    name: 'contacts.csv',
    mimeType: 'text/csv',
    buffer: csv([
      ['Name', 'Title', 'Email', 'Phone'],
      [`Chef ${stamp}`, 'Head chef', `chef-${stamp}@kolachi.pk`, '+92 300 1234567'],
      ['', 'Manager', '', ''],
    ]),
  })
  await expect(page.getByText('1 ready to import, 1 with problems')).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/import-contacts-preview.png` })
  await page.getByRole('button', { name: 'Import 1 row' }).click()
  await expect(page.getByText('Imported 1. Failed 0. Skipped 1.')).toBeVisible()
  await page.getByTestId('import-done').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('cell', { name: `Chef ${stamp}` })).toBeVisible()
  expect(w.errors).toEqual([])
})

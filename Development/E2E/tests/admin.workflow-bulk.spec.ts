import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_API, ok, adminToken, unwrap } from './support/api'
import { SEED_FILE } from './support/env'
import { settle } from './support/page-checks'

/**
 * Bulk actions and CSV export on Admin lists (GM-345). Every step is undone,
 * so the seeded data is left as the other specs expect it.
 */
const seed = () =>
  JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as {
    restaurantId: string
    restaurantName: string
    interestTableId: string
  }
const SHOTS = process.env.GM_SHOTS
const stamp = Date.now().toString(36)

async function download(page: Page, testId = 'export-csv') {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId(testId).click(),
  ])
  const path = await file.path()
  return { name: file.suggestedFilename(), text: fs.readFileSync(path!, 'utf8') }
}

test('suspends, reactivates and deletes several admin users at once', async ({ page }) => {
  const A = await adminToken()
  const roles = unwrap(await ok('GET', `${ADMIN_API}/roles/active`, A))
  const roleId = ((roles.items ?? roles) as { id: string }[])[0].id
  const names = [`Bulk Alpha ${stamp}`, `Bulk Beta ${stamp}`]
  const ids: string[] = []
  for (const [i, fullName] of names.entries()) {
    const u = unwrap(
      await ok('POST', `${ADMIN_API}/users`, A, {
        fullName,
        email: `bulk.${i}.${stamp}@gomingle.pk`,
        roleId,
        password: 'Bulk!2026pass',
        confirmPassword: 'Bulk!2026pass',
      }),
    ) as { id: string }
    ids.push(u.id)
  }
  const status = async (id: string) =>
    unwrap(await ok('GET', `${ADMIN_API}/users/${id}`, A)).status as string
  try {
    await page.goto('/users')
    await settle(page)
    for (const n of names) await page.getByRole('checkbox', { name: n }).check()
    await expect(page.getByTestId('bulk-bar')).toContainText('2 selected')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/bulk-bar.png` })

    await page.getByTestId('bulk-suspend').click()
    await expect(page.getByRole('dialog')).toContainText('Suspend 2 admin users?')
    await page.getByRole('dialog').getByRole('button', { name: 'Suspend 2' }).click()
    await expect(page.getByTestId('bulk-result')).toContainText('2 updated.')
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
    await expect.poll(() => Promise.all(ids.map(status))).toEqual(['SUSPENDED', 'SUSPENDED'])

    // One audit entry per user.
    const log = (await ok('GET', `${ADMIN_API}/change-log`, A)) as {
      newVal?: string
      oldVal?: string
      module: string
    }[]
    const mine = log.filter(
      (l) =>
        l.module === 'Users' &&
        names.some(
          (n) => JSON.stringify(l).includes(n) || JSON.stringify(l).includes(ids[names.indexOf(n)]),
        ),
    )
    expect(mine.length).toBeGreaterThanOrEqual(2)

    for (const n of names) await page.getByRole('checkbox', { name: n }).check()
    await page.getByTestId('bulk-reactivate').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Reactivate 2' }).click()
    await expect(page.getByTestId('bulk-result')).toContainText('2 updated.')
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
    await expect.poll(() => Promise.all(ids.map(status))).toEqual(['ACTIVE', 'ACTIVE'])

    for (const n of names) await page.getByRole('checkbox', { name: n }).check()
    await page.getByTestId('bulk-delete').click()
    await page.getByRole('dialog').getByRole('button', { name: 'Delete 2' }).click()
    await expect(page.getByTestId('bulk-result')).toContainText('2 updated.')
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
    for (const n of names) await expect(page.getByText(n)).toHaveCount(0)
    ids.length = 0
  } finally {
    for (const id of ids) await ok('DELETE', `${ADMIN_API}/users/${id}`, A).catch(() => undefined)
  }
})

test('exports every restaurant matching the filters as CSV', async ({ page }) => {
  const { restaurantName } = seed()
  await page.goto('/restaurants')
  await settle(page)
  const { name, text } = await download(page)
  expect(name).toMatch(/^restaurants-\d{4}-\d{2}-\d{2}\.csv$/)
  expect(text.charCodeAt(0)).toBe(0xfeff)
  const lines = text.slice(1).split('\n')
  expect(lines[0]).toBe(
    'Name,Cuisine,City,Category,Status,On the app,Confirmed bookings,Joined,Restaurant ID',
  )
  expect(text).toContain(`"${restaurantName}"`)
  await expect(page.getByText(/Exported \d+ rows?\./)).toBeVisible()
})

test('exports the approval queue and the Minglers list', async ({ page }) => {
  await page.goto('/approval-queue')
  await settle(page)
  const q = await download(page)
  expect(q.name).toMatch(/^pending-applications-/)
  expect(q.text.slice(1).split('\n')[0]).toContain('Restaurant,Cuisine,Owner')

  await page.goto('/minglers')
  await settle(page)
  const m = await download(page)
  expect(m.name).toMatch(/^minglers-/)
  expect(m.text.slice(1).split('\n')[0]).toContain('Name,Email,Phone')
})

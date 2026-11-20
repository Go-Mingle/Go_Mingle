import fs from 'node:fs'
import { test, expect, type Page } from '@playwright/test'
import { ADMIN_API, ok, adminToken, unwrap } from './support/api'
import { SEED_FILE } from './support/env'
import { settle } from './support/page-checks'

/**
 * Bulk-cancelling bookings (GM-345). Cancelled bookings stay listed, so this
 * runs in the "admin-late" project, after the partner specs that expect the
 * seeded table to have no bookings.
 */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8')) as { interestTableId: string }
const stamp = Date.now().toString(36)

async function download(page: Page) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('export-csv').click(),
  ])
  return { name: file.suggestedFilename(), text: fs.readFileSync((await file.path())!, 'utf8') }
}

test('cancels several bookings of an interest table at once', async ({ page }) => {
  const { interestTableId } = seed()
  const A = await adminToken()
  const made: { id: string; bookingRef: string }[] = []
  for (const name of [`Sana ${stamp}`, `Bilal ${stamp}`]) {
    const r = unwrap(
      await ok('POST', `${ADMIN_API}/admin/bookings/sandbox`, A, {
        interestTableId,
        minglerName: name,
        seats: 1,
      }),
    )
    made.push((r.booking ?? r) as { id: string; bookingRef: string })
  }
  try {
    await page.goto(`/interest-tables/${interestTableId}?tab=bookings`)
    await settle(page)
    for (const name of [`Sana ${stamp}`, `Bilal ${stamp}`])
      await page.getByRole('checkbox', { name: new RegExp(name) }).check()
    await page.getByTestId('bulk-cancel').click()
    await expect(page.getByRole('dialog')).toContainText('Cancel 2 bookings?')
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel 2 bookings' }).click()
    await expect(page.getByTestId('bulk-result')).toContainText('2 updated.')
    await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click()
    for (const b of made) {
      const detail = unwrap(await ok('GET', `${ADMIN_API}/admin/bookings/${b.id}`, A))
      expect(detail.status).toBe('CANCELLED')
    }
    made.length = 0

    const csv = await download(page)
    expect(csv.name).toMatch(/^bookings-/)
    expect(csv.text).toContain(`Sana ${stamp}`)
  } finally {
    for (const b of made)
      await ok('POST', `${ADMIN_API}/admin/bookings/${b.id}/cancel`, A).catch(() => undefined)
  }
})

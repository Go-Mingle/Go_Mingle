import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { SEED_FILE } from './support/env'
import { expectCleanScreen, settle, watch } from './support/page-checks'

/** Every screen of the Admin Panel, opened one after another with the seeded data. */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))

const ROUTES = [
  '/dashboard',
  '/restaurants',
  '/approval-queue',
  '/interest-tables',
  '/minglers',
  '/finances',
  '/finances/escrow',
  '/amenities',
  '/categories',
  '/email-templates',
  '/loyalty',
  '/preference-questions',
  '/roles-access',
  '/interests',
  '/interest-topics',
  '/users',
  '/notifications',
  '/change-log',
  '/timer-settings',
]

for (const route of ROUTES) {
  test(`admin ${route} opens cleanly`, async ({ page }) => {
    const w = watch(page)
    await page.goto(route)
    await settle(page)
    expect(page.url(), 'not sent back to sign-in').not.toContain('/login')
    await expectCleanScreen(page, route, { placeholders: route === '/email-templates' })
    expect(w.errors, `${route}: console errors`).toEqual([])
    expect(w.failedCalls, `${route}: failed API calls`).toEqual([])
  })
}

test('admin detail screens open cleanly', async ({ page }) => {
  const { restaurantId, interestTableId } = seed()
  for (const route of [`/restaurants/${restaurantId}`, `/interest-tables/${interestTableId}`, `/restaurants/${restaurantId}/interest-tables/${interestTableId}`]) {
    const w = watch(page)
    await page.goto(route)
    await settle(page)
    await expectCleanScreen(page, route)
    // Each tab of a detail page
    const tabs = page.locator('[role="tab"]')
    const n = await tabs.count()
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click()
      await settle(page)
      await expectCleanScreen(page, `${route} tab ${(await tabs.nth(i).innerText()).trim()}`)
    }
    expect(w.errors, `${route}: console errors`).toEqual([])
    expect(w.failedCalls, `${route}: failed API calls`).toEqual([])
  }
})

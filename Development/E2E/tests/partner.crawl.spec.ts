import fs from 'node:fs'
import { test, expect } from '@playwright/test'
import { SEED_FILE } from './support/env'
import { expectCleanScreen, settle, watch } from './support/page-checks'

/** Every screen of the Partner Portal, opened one after another with the seeded data. */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))

const ROUTES = ['/overview', '/dashboard', '/finances', '/users', '/integrations', '/notifications']

for (const route of ROUTES) {
  test(`partner ${route} opens cleanly`, async ({ page }) => {
    const w = watch(page)
    await page.goto(route)
    await settle(page)
    expect(page.url(), 'not sent back to sign-in').not.toContain('/login')
    await expectCleanScreen(page, route)
    const tabs = page.locator('[role="tab"]')
    const n = await tabs.count()
    for (let i = 0; i < n; i++) {
      await tabs.nth(i).click()
      await settle(page)
      await expectCleanScreen(page, `${route} tab ${(await tabs.nth(i).innerText()).trim()}`)
    }
    expect(w.errors, `${route}: console errors`).toEqual([])
    expect(w.failedCalls, `${route}: failed API calls`).toEqual([])
  })
}

test('partner interest table detail opens cleanly', async ({ page }) => {
  const { interestTableId } = seed()
  const w = watch(page)
  await page.goto(`/interest-tables/${interestTableId}`)
  await settle(page)
  await expectCleanScreen(page, 'interest table detail')
  expect(w.errors).toEqual([])
  expect(w.failedCalls).toEqual([])
})

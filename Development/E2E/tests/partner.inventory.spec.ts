import fs from 'node:fs'
import { test } from '@playwright/test'
import { SEED_FILE } from './support/env'
import { settle } from './support/page-checks'
import { checkInventory, inventoryOf, type Inventory } from './support/inventory'

/** Every Partner Portal screen, tab and form must survive the redesign (GM-343). */
const ROUTES = ['/overview', '/dashboard', '/finances', '/users', '/notifications']

test('partner UI inventory is intact', async ({ page }) => {
  test.setTimeout(30 * 60_000)
  const { interestTableId } = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
  const routes = [...ROUTES, `/interest-tables/${interestTableId}`]
  const inv: Inventory = {}
  for (const route of routes) {
    await page.goto(route)
    await settle(page)
    const key = route.replace(interestTableId, ':tableId')
    const tabs = (await page.locator('[role="tab"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean)
    if (tabs.length === 0) inv[key] = await inventoryOf(page, route)
    for (const tab of tabs) inv[`${key} [${tab.replace(/\s*\d+$/, '')}]`] = await inventoryOf(page, route, tab)
  }
  checkInventory('partner', inv)
})

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test('partner sign-in screens inventory is intact', async ({ page }) => {
    const inv: Inventory = {}
    for (const route of ['/login', '/signup']) inv[route] = await inventoryOf(page, route)
    checkInventory('partner-public', inv)
  })
})

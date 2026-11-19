import fs from 'node:fs'
import { test } from '@playwright/test'
import { SEED_FILE } from './support/env'
import { settle } from './support/page-checks'
import { checkInventory, inventoryOf, type Inventory } from './support/inventory'

/** Every Admin screen, tab and form must survive the redesign (GM-343). */
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

test('admin UI inventory is intact', async ({ page }) => {
  test.setTimeout(30 * 60_000)
  const { restaurantId, interestTableId } = JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
  const routes = [...ROUTES, `/restaurants/${restaurantId}`, `/interest-tables/${interestTableId}`]
  const inv: Inventory = {}
  for (const route of routes) {
    await page.goto(route)
    await settle(page)
    const key = route.replace(restaurantId, ':restaurantId').replace(interestTableId, ':tableId')
    const tabs = (await page.locator('[role="tab"]').allInnerTexts()).map((t) => t.trim()).filter(Boolean)
    if (tabs.length === 0) inv[key] = await inventoryOf(page, route)
    for (const tab of tabs) inv[`${key} [${tab.replace(/\s*\d+$/, '')}]`] = await inventoryOf(page, route, tab)
  }
  checkInventory('admin', inv)
})

test.describe('signed out', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test('admin sign-in screens inventory is intact', async ({ page }) => {
    const inv: Inventory = {}
    for (const route of ['/login']) inv[route] = await inventoryOf(page, route)
    checkInventory('admin-public', inv)
  })
})

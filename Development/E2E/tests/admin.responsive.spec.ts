import fs from 'node:fs'
import { test } from '@playwright/test'
import { SEED_FILE } from './support/env'
import { VIEWPORTS, checkRoute } from './support/responsive'

/** Every Admin screen fits a phone and a tablet without sideways scrolling (GM-341). */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
const ROUTES = [
  '/dashboard', '/restaurants', '/approval-queue', '/interest-tables', '/minglers', '/finances', '/finances/escrow',
  '/amenities', '/categories', '/email-templates', '/loyalty', '/preference-questions', '/roles-access', '/interests',
  '/interest-topics', '/users', '/notifications', '/change-log', '/timer-settings'
]

for (const vp of VIEWPORTS) {
  test.describe(`admin on a ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })
    for (const route of ROUTES) test(`${route} fits`, async ({ page }) => checkRoute(page, route))
    test('detail screens fit', async ({ page }) => {
      const { restaurantId, interestTableId } = seed()
      for (const r of [`/restaurants/${restaurantId}`, `/interest-tables/${interestTableId}`]) await checkRoute(page, r)
    })
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`admin sign-in screens on a ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    for (const route of ['/login']) test(`${route} fits`, async ({ page }) => checkRoute(page, route))
  })
}

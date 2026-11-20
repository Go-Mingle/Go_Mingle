import fs from 'node:fs'
import { test } from '@playwright/test'
import { SEED_FILE } from './support/env'
import { VIEWPORTS, checkRoute } from './support/responsive'

/** Every Partner screen fits a phone and a tablet without sideways scrolling (GM-341). */
const seed = () => JSON.parse(fs.readFileSync(SEED_FILE, 'utf8'))
const ROUTES = ['/overview', '/dashboard', '/finances', '/users', '/notifications']

for (const vp of VIEWPORTS) {
  test.describe(`partner on a ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } })
    for (const route of ROUTES) test(`${route} fits`, async ({ page }) => checkRoute(page, route))
    test('interest table detail fits', async ({ page }) => {
      await checkRoute(page, `/interest-tables/${seed().interestTableId}`)
    })
  })
}

for (const vp of VIEWPORTS) {
  test.describe(`partner sign-in screens on a ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    for (const route of ['/login', '/signup']) test(`${route} fits`, async ({ page }) => checkRoute(page, route))
  })
}

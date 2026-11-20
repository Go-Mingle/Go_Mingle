import { expect, type Page } from '@playwright/test'
import { settle } from './page-checks'

/** Phone and tablet widths every screen must fit without sideways scrolling (GM-341). */
export const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
] as const

/**
 * Elements that stick out past the right edge of the screen. Content inside a
 * horizontally scrolling box (a wide table, a tab strip) is fine: it scrolls
 * within its own box, not the page.
 */
export async function overflowing(page: Page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        const s = getComputedStyle(p)
        // A box that scrolls sideways is fine; one that silently clips is not,
        // except Ant's tab strip, which moves the rest into its "more" menu.
        if (/(auto|scroll)/.test(s.overflowX) && p.scrollWidth > p.clientWidth) return true
        if (p.classList.contains('ant-tabs-nav-wrap') || p.classList.contains('gm-stage') || p.hasAttribute('data-decorative')) return true
      }
      return false
    }
    const out: string[] = []
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      const r = el.getBoundingClientRect()
      if (!r.width || r.right <= W + 1) continue
      const s = getComputedStyle(el)
      if (s.position === 'fixed' || s.visibility === 'hidden' || s.display === 'none') continue
      if (el.closest('.ant-modal-wrap, .ant-drawer, .ant-dropdown, .ant-select-dropdown, .ant-picker-dropdown, .ant-tooltip, .ant-popover, [aria-hidden="true"]')) continue
      if (inScroller(el)) continue
      const cls = typeof el.className === 'string' ? el.className.split(' ').slice(0, 3).join('.') : ''
      out.push(`${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} right=${Math.round(r.right)}`)
      if (out.length > 4) break
    }
    return { pageWidth: document.documentElement.scrollWidth, viewport: W, culprits: out }
  })
}

export async function expectFits(page: Page, label: string) {
  const r = await overflowing(page)
  expect(
    { label, scrolls: r.pageWidth > r.viewport + 1, culprits: r.culprits },
    `${label}: page is ${r.pageWidth}px wide in a ${r.viewport}px screen`,
  ).toEqual({ label, scrolls: false, culprits: [] })
}

/** Opens a route and every tab on it, checking each fits. */
export async function checkRoute(page: Page, route: string) {
  await page.goto(route)
  await settle(page)
  const shots = process.env.GM_SHOTS
  if (shots) {
    const vw = page.viewportSize()?.width ?? 0
    const app = page.url().includes(":5173") ? "admin" : "partner"
    await page.screenshot({ path: `${shots}/${app}-m${vw}${route.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true })
  }
  await expectFits(page, route)
  const tabs = page.locator('[role="tab"]:visible')
  const n = await tabs.count()
  for (let i = 0; i < n; i++) {
    const tab = tabs.nth(i)
    const name = (await tab.innerText()).trim()
    await tab.click()
    await settle(page)
    await expectFits(page, `${route} tab ${name}`)
  }
}

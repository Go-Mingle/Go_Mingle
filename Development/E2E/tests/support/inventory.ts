import fs from 'node:fs'
import path from 'node:path'
import { expect, type Page } from '@playwright/test'
import { settle } from './page-checks'

/**
 * The UI inventory: every heading, tab, field label, column and button a screen
 * offers, plus the fields inside the dialogs its "New / Add / Edit / Invite"
 * buttons open. Recorded once from the current build, then checked after every
 * visual change so a redesign can only change how things look, never what is
 * there (GM-343).
 *
 *   GM_UPDATE_INVENTORY=1 npx playwright test --project=admin -g inventory
 *   then, on a fresh seed, GM_UPDATE_INVENTORY=intersect (drops data-dependent items)
 */
export type Inventory = Record<string, string[]>

const DIR = new URL('../../inventory/', import.meta.url).pathname
const UPDATE = process.env.GM_UPDATE_INVENTORY === '1'
/** Second recording pass: keep only what both passes saw, so data-dependent items do not count. */
const INTERSECT = process.env.GM_UPDATE_INVENTORY === 'intersect'

/** Buttons that open a form we also want to inventory. */
const OPENERS = /^(\+\s*)?(new|add|create|invite|edit)\b/i

/** Visible text that is data, not UI: counts, dates, money, ids. */
const isData = (s: string) => /\d/.test(s) || s.length > 80 || s.length < 2

const norm = (s: string) =>
  s
    .replace(/\s+/g, ' ')
    .replace(/[*:]+$/, '')
    .trim()

/** What the screen offers right now, scoped to `root` (the page or an open dialog). */
async function capture(page: Page, root = 'body'): Promise<string[]> {
  const items = await page.$$eval(`${root}`, (roots) => {
    const out: string[] = []
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const cs = getComputedStyle(el as HTMLElement)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const inRows = (el: Element) => !!el.closest('.ant-table-tbody, [role="rowgroup"] [role="row"]')
    for (const rootEl of roots) {
      for (const el of rootEl.querySelectorAll('h1,h2,h3,h4')) if (visible(el)) out.push(`heading:${el.textContent ?? ''}`)
      for (const el of rootEl.querySelectorAll('[role="tab"]')) out.push(`tab:${el.textContent ?? ''}`)
      for (const el of rootEl.querySelectorAll('label, .ant-form-item-label')) if (visible(el)) out.push(`field:${el.textContent ?? ''}`)
      for (const el of rootEl.querySelectorAll('input, textarea, select')) {
        const i = el as HTMLInputElement
        if (!visible(i) || i.type === 'hidden') continue
        const name = i.getAttribute('aria-label') || i.getAttribute('placeholder') || i.getAttribute('name')
        if (name) out.push(`input:${name}`)
      }
      for (const el of rootEl.querySelectorAll('th')) if (visible(el)) out.push(`column:${el.textContent ?? ''}`)
      for (const el of rootEl.querySelectorAll('button, [role="button"], a[href]')) {
        if (!visible(el) || inRows(el)) continue
        const name = el.getAttribute('aria-label') || el.textContent || el.getAttribute('title')
        if (name) out.push(`action:${name}`)
      }
    }
    return out
  })
  return [
    ...new Set(
      items
        .map((s) => s.replace(/\s+/g, ' ').trim())
        .map((s) => {
          const [kind, ...rest] = s.split(':')
          return `${kind}:${norm(rest.join(':'))}`
        })
        .filter((s) => !isData(s.slice(s.indexOf(':') + 1))),
    ),
  ].sort()
}

/** The screen plus each form its opener buttons reveal. */
export async function inventoryOf(page: Page, url: string, tab?: string): Promise<string[]> {
  const open = async () => {
    await page.goto(url)
    await settle(page)
    if (url !== '/login' && url !== '/signup') expect(new URL(page.url()).pathname, `${url}: signed out while taking the inventory`).not.toBe('/login')
    if (tab) {
      await page.getByRole('tab', { name: tab, exact: true }).click()
      await settle(page)
    }
  }
  await open()
  const items = new Set(await capture(page))
  const openers = (
    await page.$$eval('button, [role="button"]', (els) =>
      els
        .filter((el) => !el.closest('.ant-table-tbody, .ant-modal, .ant-drawer') && (el as HTMLElement).offsetParent !== null)
        .map((el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim()),
    )
  ).filter((n, i, all) => OPENERS.test(n) && all.indexOf(n) === i)

  for (const name of openers) {
    const button = page.getByRole('button', { name, exact: true }).first()
    if (!(await button.isVisible().catch(() => false)) || !(await button.isEnabled().catch(() => false))) continue
    await button.click().catch(() => undefined)
    await settle(page)
    if (process.env.GM_INVENTORY_DEBUG) console.log(url, tab ?? '', '->', name, page.url())
    const dialog = page.locator('.ant-modal-wrap:visible, .ant-drawer-open, [role="dialog"]:visible').first()
    const scope = (await dialog.count()) ? '.ant-modal-wrap:not([style*="display: none"]), .ant-drawer-open' : 'body'
    for (const item of await capture(page, scope)) items.add(`${name} > ${item}`)
    await open()
  }
  return [...items].sort()
}

/**
 * Writes the inventory (update mode) or checks nothing recorded before has gone
 * missing. New items are fine; missing ones fail with the full list.
 */
export function checkInventory(portal: string, current: Inventory) {
  const file = path.join(DIR, `${portal}.json`)
  if (INTERSECT && fs.existsSync(file)) {
    const previous: Inventory = JSON.parse(fs.readFileSync(file, 'utf8'))
    const merged: Inventory = {}
    for (const [screen, items] of Object.entries(previous)) {
      const now = new Set(current[screen] ?? [])
      merged[screen] = items.filter((i) => now.has(i))
    }
    fs.writeFileSync(file, JSON.stringify(merged, null, 2) + '\n')
    return
  }
  if (UPDATE || !fs.existsSync(file)) {
    fs.mkdirSync(DIR, { recursive: true })
    fs.writeFileSync(file, JSON.stringify(current, null, 2) + '\n')
    return
  }
  const baseline: Inventory = JSON.parse(fs.readFileSync(file, 'utf8'))
  const missing: string[] = []
  for (const [screen, items] of Object.entries(current)) {
    const have = new Set(items)
    for (const item of baseline[screen] ?? []) if (!have.has(item)) missing.push(`${screen} :: ${item}`)
  }
  expect(missing, `${portal}: things the redesign lost (re-record with GM_UPDATE_INVENTORY=1 only if the change is intended)`).toEqual([])
}

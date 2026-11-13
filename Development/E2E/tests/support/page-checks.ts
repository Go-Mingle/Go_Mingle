import { expect, type Page } from '@playwright/test'
import { API_URL } from './env'

export interface PageWatch {
  /** Console errors and uncaught exceptions on the page. */
  errors: string[]
  /** API calls that failed (5xx always; 4xx unless listed as expected). */
  failedCalls: string[]
  /** Slowest API call seen, for the performance note in the report. */
  slowest: { url: string; ms: number }
}

/** Origins the portals may call that a test machine might not reach (fonts, Google sign-in, maps). */
const EXTERNAL = /fonts\.(googleapis|gstatic)\.com|accounts\.google\.com|maps\.googleapis\.com|sentry\.io/

/**
 * Starts collecting what goes wrong on a page: console errors, page crashes and
 * failing API calls. Call before the first navigation.
 */
export function watch(page: Page, allow4xx: RegExp[] = []): PageWatch {
  const w: PageWatch = { errors: [], failedCalls: [], slowest: { url: '', ms: 0 } }
  const started = new Map<string, number>()
  page.on('pageerror', (err) => w.errors.push(`page error: ${err.message}`))
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (EXTERNAL.test(text) || /ERR_TUNNEL_CONNECTION_FAILED|ERR_NAME_NOT_RESOLVED/.test(text)) return
    // The API answered with an error status: reported through failedCalls instead.
    if (/Failed to load resource: the server responded with a status of/.test(text)) return
    w.errors.push(text)
  })
  page.on('request', (req) => started.set(req.url() + req.method(), Date.now()))
  page.on('response', (res) => {
    const url = res.url()
    if (!url.startsWith(API_URL)) return
    const t0 = started.get(url + res.request().method())
    if (t0 !== undefined) {
      const ms = Date.now() - t0
      if (ms > w.slowest.ms) w.slowest = { url: `${res.request().method()} ${url.replace(API_URL, '')}`, ms }
    }
    const s = res.status()
    if (s >= 500 || (s >= 400 && !allow4xx.some((re) => re.test(url)))) w.failedCalls.push(`${res.request().method()} ${url.replace(API_URL, '')} -> ${s}`)
  })
  return w
}

/** Waits for the page to settle: network quiet and no loading spinners. */
export async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 20_000 }).catch(() => undefined)
  await page
    .locator('.ant-spin-spinning, .ant-skeleton-active, [aria-busy="true"]')
    .first()
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined)
}

/**
 * What every screen must get right: no raw placeholders or broken values in the
 * visible text, no broken images, no error screen.
 */
export async function expectCleanScreen(page: Page, label: string, opts: { placeholders?: boolean } = {}) {
  const text = await page.locator('body').innerText()
  // `{{name}}` is a template placeholder: only the Email Templates screen may show it.
  const pattern = opts.placeholders
    ? /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\bInfinity\b/g
    : /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\bInfinity\b|\{\{\s*\w+\s*\}\}/g
  const bad = text.match(pattern)
  expect(bad, `${label}: broken values on screen`).toBeNull()
  // i18n keys that were never translated look like "module.section.key".
  const keys = text.match(/\b[a-z]+(?:[A-Z][a-z]+)*\.[a-z]+(?:[A-Z][a-z]+)*\.[a-z]+(?:[A-Z][a-z]+)*\b/g) ?? []
  expect(keys.filter((k) => !/\.(com|pk|app|org|net|io)\b/.test(k)), `${label}: untranslated text keys`).toEqual([])
  expect(text, `${label}: error screen`).not.toMatch(/Something went wrong|Unexpected Application Error|Page not found/i)
  const broken = await page.$$eval('img', (imgs) =>
    imgs.filter((i) => i.complete && i.naturalWidth === 0 && i.getAttribute('src') && !/googleusercontent|gstatic/.test(i.src)).map((i) => i.src),
  )
  expect(broken, `${label}: broken images`).toEqual([])
}

/** Collapses whitespace so a number split across elements still matches. */
export async function screenText(page: Page) {
  return (await page.locator('body').innerText()).replace(/\s+/g, ' ')
}

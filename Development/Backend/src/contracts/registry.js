import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { config } from '../config.js'

/**
 * Loads the portal contract modules.
 *
 * Admin: one shared instance — the platform-wide view.
 * Partner: one isolated instance per restaurant (a "tenant"), so every partner
 * restaurant has its own profile, menu, media, tables, team, inbox and
 * finances. Node caches ES modules by URL, so importing the same file with a
 * different `?tenant=` query gives a fresh module with its own state.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const adminUrl = pathToFileURL(path.join(root, 'contracts', 'admin.mjs')).href
const partnerUrl = pathToFileURL(path.join(root, 'contracts', 'partner.mjs')).href

globalThis.GM_PUBLIC_URL = config.publicUrl
globalThis.location = new URL(`${config.publicUrl}/`)

const tenants = new Map() // restaurantId -> Promise<namespace>
let chain = Promise.resolve()

/**
 * Upload and media URLs are fixed when a partner module is evaluated, so each
 * tenant is evaluated with its own base (`/t/<restaurantId>`) — one at a time.
 */
function importPartner(key, base) {
  const run = async () => {
    const previous = globalThis.GM_PUBLIC_URL
    globalThis.GM_PUBLIC_URL = base
    try {
      return await import(`${partnerUrl}?tenant=${encodeURIComponent(key)}`)
    } finally {
      globalThis.GM_PUBLIC_URL = previous
    }
  }
  const next = chain.then(run, run)
  chain = next.catch(() => undefined)
  return next
}

export const admin = await import(adminUrl)

// Sign-up runs before a restaurant exists, on its own instance.
export const signup = await importPartner('signup', `${config.publicUrl}/t/signup`)

/** The isolated partner contract for one restaurant. */
export function tenant(restaurantId) {
  if (!tenants.has(restaurantId)) {
    tenants.set(restaurantId, importPartner(restaurantId, `${config.publicUrl}/t/${restaurantId}`))
  }
  return tenants.get(restaurantId)
}

export function isTenantLoaded(restaurantId) {
  return tenants.has(restaurantId)
}

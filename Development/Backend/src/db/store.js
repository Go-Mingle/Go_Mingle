import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Persistent store — one JSON document on disk (data/gomingle-db.json).
 *
 * Holds everything that must survive a restart and that both portals share:
 * accounts, partner restaurants (profile, contacts, amenities, status history)
 * and the admin-side restaurant / application records those restaurants
 * produce. Writes are debounced and atomic (temp file + rename).
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const FILE = process.env.DATA_FILE ?? path.join(root, 'data', 'gomingle-db.json')

function empty() {
  return {
    version: 1,
    users: [],
    /** Partner restaurants, keyed by restaurant id. */
    restaurants: {},
    /** Admin-side records written by the API, re-applied on start. */
    admin: { restaurants: {}, applications: {}, deletedApplications: [] },
  }
}

const ephemeral = process.env.NODE_ENV === 'test' && !process.env.DATA_FILE

export const db = (() => {
  if (ephemeral) return empty()
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    return { ...empty(), ...data, admin: { ...empty().admin, ...(data.admin ?? {}) } }
  } catch {
    return empty()
  }
})()

let timer = null

export function save() {
  if (ephemeral) return
  clearTimeout(timer)
  timer = setTimeout(flush, 150)
}

export function flush() {
  clearTimeout(timer)
  if (ephemeral) return
  fs.mkdirSync(path.dirname(FILE), { recursive: true })
  const tmp = `${FILE}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2))
  fs.renameSync(tmp, FILE)
}

export const dataFile = FILE

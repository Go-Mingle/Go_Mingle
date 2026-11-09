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

/**
 * Version 2 is the first release that keeps every record (see src/state.js)
 * and starts without demo data. A store from an earlier build holds demo
 * records, so it is set aside (renamed to *.v1-backup.json) and the install
 * starts clean.
 */
const VERSION = 2

function empty() {
  return {
    version: VERSION,
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
  let data
  try {
    data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
  } catch {
    return empty()
  }
  if (data.version !== VERSION) {
    fs.renameSync(FILE, FILE.replace(/\.json$/, '') + '.v1-backup.json')
    fs.rmSync(path.join(path.dirname(FILE), 'state'), { recursive: true, force: true })
    console.log(`Earlier demo data moved to ${path.basename(FILE).replace(/\.json$/, '')}.v1-backup.json — starting clean.`)
    return empty()
  }
  return { ...empty(), ...data, admin: { ...empty().admin, ...(data.admin ?? {}) } }
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

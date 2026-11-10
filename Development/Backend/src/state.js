import fs from 'node:fs'
import path from 'node:path'
import { dataFile } from './db/store.js'

/**
 * Durable state for the portal contract instances.
 *
 * Every record the portals create — roles, users, categories, amenities,
 * topics, partner tables, menu options, media, interest tables, notifications,
 * uploaded file bytes — lives in module-level stores inside the contract
 * bundles. The build (scripts/state-plugin.mjs) gives each of those modules a
 * read/write accessor; this file snapshots them to disk after every change and
 * restores them on start, so nothing a user enters is lost on a restart.
 *
 * Files: <data dir>/state/admin.json and <data dir>/state/tenant-<id>.json.
 */

const ephemeral = process.env.NODE_ENV === 'test' && !process.env.DATA_FILE
const dir = path.join(path.dirname(dataFile), 'state')

const SKIP = Symbol('skip')

/** Encodes a value as JSON-safe data, or SKIP when it holds code. */
export function encode(value, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (value === undefined) return { $undef: 1 }
  if (typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') return SKIP
  if (seen.has(value)) return SKIP
  seen.add(value)
  try {
    if (value instanceof Date) return { $date: value.toISOString() }
    if (value instanceof ArrayBuffer) return { $ab: Buffer.from(value).toString('base64') }
    if (ArrayBuffer.isView(value)) return { $u8: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64') }
    if (value instanceof Map) {
      const entries = []
      for (const [k, v] of value) {
        const ek = encode(k, seen)
        const ev = encode(v, seen)
        if (ek === SKIP || ev === SKIP) return SKIP
        entries.push([ek, ev])
      }
      return { $map: entries }
    }
    if (value instanceof Set) {
      const items = []
      for (const v of value) {
        const ev = encode(v, seen)
        if (ev === SKIP) return SKIP
        items.push(ev)
      }
      return { $set: items }
    }
    if (Array.isArray(value)) {
      const out = []
      for (const v of value) {
        const ev = encode(v, seen)
        if (ev === SKIP) return SKIP
        out.push(ev)
      }
      return out
    }
    const proto = Object.getPrototypeOf(value)
    if (proto !== Object.prototype && proto !== null) return SKIP
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      const ev = encode(v, seen)
      if (ev === SKIP) return SKIP
      out[k] = ev
    }
    return out
  } finally {
    seen.delete(value)
  }
}

export function decode(value) {
  if (Array.isArray(value)) return value.map(decode)
  if (!value || typeof value !== 'object') return value
  if ('$undef' in value) return undefined
  if ('$date' in value) return new Date(value.$date)
  if ('$ab' in value) {
    const b = Buffer.from(value.$ab, 'base64')
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
  }
  if ('$u8' in value) return new Uint8Array(Buffer.from(value.$u8, 'base64'))
  if ('$map' in value) return new Map(value.$map.map(([k, v]) => [decode(k), decode(v)]))
  if ('$set' in value) return new Set(value.$set.map(decode))
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, decode(v)]))
}

/** All data held by one contract instance, keyed module → binding. */
export function capture(ns) {
  const out = {}
  for (const [name, accessor] of ns.stateModules) {
    const bindings = {}
    for (const [key, value] of Object.entries(accessor.read())) {
      const encoded = encode(value)
      if (encoded !== SKIP) bindings[key] = encoded
    }
    if (Object.keys(bindings).length) out[name] = bindings
  }
  return out
}

/**
 * Writes `next` into the live binding, keeping object identity wherever the
 * shapes agree (other modules hold references to these arrays and maps).
 */
function assignInPlace(current, next, write) {
  if (Array.isArray(current) && Array.isArray(next)) {
    current.splice(0, current.length, ...next)
    return
  }
  if (current instanceof Map && next instanceof Map) {
    current.clear()
    for (const [k, v] of next) current.set(k, v)
    return
  }
  if (current instanceof Set && next instanceof Set) {
    current.clear()
    for (const v of next) current.add(v)
    return
  }
  const plain = (v) => v && typeof v === 'object' && Object.getPrototypeOf(v) === Object.prototype
  if (plain(current) && plain(next)) {
    for (const k of Object.keys(current)) if (!(k in next)) delete current[k]
    Object.assign(current, next)
    return
  }
  write(next)
}

/** Restores a captured snapshot into a contract instance. */
export function apply(ns, snapshot) {
  for (const [name, bindings] of Object.entries(snapshot ?? {})) {
    const accessor = ns.stateModules.get(name)
    if (!accessor) continue
    const live = accessor.read()
    for (const [key, encoded] of Object.entries(bindings)) {
      if (!(key in live)) continue
      assignInPlace(live[key], decode(encoded), (v) => accessor.write(key, v))
    }
  }
}

/**
 * Sets bindings by module and name: `{ 'data/index.ts': { mockMinglers: [] } }`.
 * Used to start a fresh install without demo records.
 */
export function override(ns, spec) {
  for (const [name, bindings] of Object.entries(spec)) {
    const accessor = ns.stateModules.get(name)
    if (!accessor) throw new Error(`No state module ${name}`)
    const live = accessor.read()
    for (const [key, value] of Object.entries(bindings)) {
      if (!(key in live)) throw new Error(`No binding ${name}#${key}`)
      const next = typeof value === 'function' ? value(live[key]) : value
      assignInPlace(live[key], next, (v) => accessor.write(key, v))
    }
  }
}

const fileFor = (key) => path.join(dir, `${key}.json`)

export function load(key) {
  if (ephemeral) return null
  try {
    return JSON.parse(fs.readFileSync(fileFor(key), 'utf8'))
  } catch {
    return null
  }
}

export function store(key, ns) {
  if (ephemeral) return
  fs.mkdirSync(dir, { recursive: true })
  const file = fileFor(key)
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(capture(ns)))
  fs.renameSync(`${file}.tmp`, file)
}

export const stateDir = dir

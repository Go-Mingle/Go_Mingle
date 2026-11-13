import { API_URL, ADMIN, PARTNER } from './env'

export type Json = any // eslint-disable-line @typescript-eslint/no-explicit-any

export const ADMIN_API = `${API_URL}/admin/api/v1`
export const PARTNER_API = `${API_URL}/partner/api/v1/partner`

export interface Reply {
  status: number
  json: Json
  ms: number
}

/** Small fetch wrapper: JSON in, JSON out, with the time each call took. */
export async function call(method: string, url: string, token?: string, body?: unknown): Promise<Reply> {
  const started = Date.now()
  const res = await fetch(url, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: Json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json, ms: Date.now() - started }
}

/** Calls that must succeed: throws with the response when they do not. */
export async function ok(method: string, url: string, token?: string, body?: unknown): Promise<Json> {
  const r = await call(method, url, token, body)
  if (r.status >= 300) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(r.json).slice(0, 400)}`)
  return r.json
}

export async function adminToken(): Promise<string> {
  const r = await ok('POST', `${ADMIN_API}/auth/login`, undefined, ADMIN)
  return r.accessToken ?? r.data?.accessToken
}

export async function partnerToken(): Promise<string> {
  const r = await ok('POST', `${PARTNER_API}/auth/login`, undefined, PARTNER)
  return r.accessToken ?? r.data?.accessToken
}

/** Lists come back as `{data: {items}}`, `{items}`, `{data: [...]}` or a bare array. */
export function itemsOf(j: Json): Json[] {
  const v = j?.data?.items ?? j?.items ?? j?.data ?? j
  return Array.isArray(v) ? v : []
}

/** Single objects come back bare or as `{data: {...}}`. */
export const unwrap = (j: Json): Json => (j && typeof j === 'object' && 'data' in j && j.data && !Array.isArray(j.data) ? j.data : j)

/** Text that must never reach a screen or a response. */
export const BAD_TEXT = /\bundefined\b|\bNaN\b|\[object Object\]|Invalid Date|\bInfinity\b/

/** Every string value in a JSON tree, with its path. */
export function* strings(j: Json, path = ''): Generator<[string, string]> {
  if (typeof j === 'string') yield [path, j]
  else if (Array.isArray(j)) for (let i = 0; i < j.length; i++) yield* strings(j[i], `${path}[${i}]`)
  else if (j && typeof j === 'object') for (const [k, v] of Object.entries(j)) yield* strings(v, path ? `${path}.${k}` : k)
}

/** Every number in a JSON tree that is not finite. */
export function* badNumbers(j: Json, path = ''): Generator<string> {
  if (typeof j === 'number' && !Number.isFinite(j)) yield path
  else if (Array.isArray(j)) for (let i = 0; i < j.length; i++) yield* badNumbers(j[i], `${path}[${i}]`)
  else if (j && typeof j === 'object') for (const [k, v] of Object.entries(j)) yield* badNumbers(v, path ? `${path}.${k}` : k)
}

/** "3500" -> "3,500": how the portals print money. */
export const grouped = (n: number) => Math.round(n).toLocaleString('en-US')

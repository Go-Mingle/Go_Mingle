import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request, Response } from 'express'

/**
 * Bodies arrive as raw bytes (uploads need them exactly). JSON is parsed on
 * demand; a missing or malformed body reads as `{}`, as the old API did.
 */
export function jsonBody<T = Record<string, unknown>>(req: Request): T {
  const r = req as Request & { _json?: unknown }
  if (r._json !== undefined) return r._json as T
  const raw = req.body as Buffer | undefined
  try {
    r._json = raw && raw.length ? JSON.parse(raw.toString('utf8')) : {}
  } catch {
    r._json = {}
  }
  if (r._json === null || typeof r._json !== 'object') r._json = {}
  return r._json as T
}

/** The parsed JSON body of the request (`{}` when absent or malformed). */
export const Body = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  jsonBody(ctx.switchToHttp().getRequest<Request>()),
)

/** The raw request bytes. */
export const RawBody = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const body = ctx.switchToHttp().getRequest<Request>().body
  return Buffer.isBuffer(body) ? body : Buffer.alloc(0)
})

/** Query string values as plain strings (first value wins). */
export const Query = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const q = ctx.switchToHttp().getRequest<Request>().query
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(q)) {
    const first = Array.isArray(v) ? v[0] : v
    if (first !== undefined) out[k] = String(first)
  }
  return out
})

export type Req = Request
export type Res = Response

/** Number from a query value, with a fallback for missing / invalid input. */
export function num(value: string | undefined, fallback: number): number {
  if (value === undefined || value === '') return fallback
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

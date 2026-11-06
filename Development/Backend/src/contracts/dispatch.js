import { getResponse } from 'msw'
import { config } from '../config.js'

/**
 * Serves a request from a portal's API contract module.
 *
 * Converts the Express request into a Fetch `Request` rooted at this server's
 * public origin, resolves it against the contract's route handlers and copies
 * the resulting `Response` back. Returns false when no route matches.
 *
 * @param {object} opts
 * @param {Array} opts.handlers  route handlers from contracts/<portal>.mjs
 * @param {string} opts.path     request path with the portal prefix removed
 * @param {object} [opts.override] { headers?, body? } — used by auth hooks
 */
export async function toFetchRequest(req, path, override = {}) {
  const url = new URL(path, `${config.publicUrl}/`)
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined || key === 'host' || key === 'content-length') continue
    headers.set(key, Array.isArray(value) ? value.join(', ') : String(value))
  }
  for (const [key, value] of Object.entries(override.headers ?? {})) headers.set(key, value)
  const hasBody = !['GET', 'HEAD'].includes(req.method)
  let body
  if (hasBody) {
    body = override.body !== undefined ? override.body : req.body && req.body.length ? req.body : undefined
  }
  return new Request(url, { method: req.method, headers, body, duplex: 'half' })
}

export async function resolveContract(handlers, request) {
  return getResponse(handlers, request)
}

export async function sendFetchResponse(res, response) {
  res.status(response.status)
  response.headers.forEach((value, key) => {
    if (['content-length', 'content-encoding', 'transfer-encoding', 'connection'].includes(key)) return
    res.setHeader(key, value)
  })
  if (response.status === 204 || response.status === 304 || response.body === null) {
    res.end()
    return
  }
  res.end(Buffer.from(await response.arrayBuffer()))
}

export async function dispatch(req, res, handlers, path, override) {
  const request = await toFetchRequest(req, path, override)
  const response = await resolveContract(handlers, request)
  if (!response) return false
  await sendFetchResponse(res, response)
  return true
}

/** Small helpers shared by the routers. */

export function sendError(res, status, code, message, details) {
  res.status(status).json({ success: false, error: { code, message, ...(details ? { details } : {}) } })
}

/** Bodies arrive as raw Buffers (the contract dispatcher needs the bytes); parse JSON on demand. */
export function jsonBody(req) {
  if (req._json !== undefined) return req._json
  try {
    req._json = req.body && req.body.length ? JSON.parse(req.body.toString('utf8')) : {}
  } catch {
    req._json = {}
  }
  return req._json
}

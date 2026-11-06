import express from 'express'
import { jsonBody, sendError } from '../http.js'
import {
  checkCode,
  checkPassword,
  clearCode,
  createUser,
  findUser,
  findUserById,
  issueCode,
  lockRemainingMs,
  meetsPasswordPolicy,
  normaliseEmail,
  recordFailure,
  recordSuccess,
  setPassword,
} from './users.js'
import {
  bearer,
  consumeRefreshToken,
  issueTokens,
  revokeUserRefreshTokens,
  verifyAccessToken,
} from './tokens.js'

/**
 * Partner Portal authentication — /partner/api/v1/partner/auth/*.
 *
 * Error codes match the portal's AuthErrorCode union so the existing copy and
 * flows apply unchanged.
 */

export const PARTNER_AUDIENCE = 'gomingle-partner'
const BASE = '/api/v1/partner/auth'

function identity(user) {
  return { id: user.id, email: user.email, fullName: user.fullName }
}

function lockMessage(ms) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000))
  return `Your account is temporarily locked. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/** Resolves the signed-in partner from the Bearer token, or sends 401/403. */
export function requirePartner(req, res) {
  const { claims, error } = verifyAccessToken(bearer(req), PARTNER_AUDIENCE)
  if (!claims) {
    sendError(res, 401, error, 'Authentication required')
    return null
  }
  const user = findUserById(claims.sub)
  if (!user) {
    sendError(res, 401, 'ERR_TOKEN_INVALID', 'Unknown user')
    return null
  }
  if (user.status !== 'ACTIVE') {
    sendError(res, 403, 'ERR_ACCOUNT_SUSPENDED', 'Account suspended')
    return null
  }
  return user
}

/** Used by the sign-up hook once the e-mail code is verified. */
export function provisionPartner(email) {
  return findUser(email, 'partner') ?? createUser({
    email,
    fullName: normaliseEmail(email).split('@')[0],
    portal: 'partner',
  })
}

export { setPassword, meetsPasswordPolicy }

export function partnerAuthRouter() {
  const r = express.Router()

  r.post(`${BASE}/login`, (req, res) => {
    const { email, password } = jsonBody(req)
    const user = findUser(email, 'partner')
    const locked = lockRemainingMs(user)
    if (locked) return sendError(res, 403, 'PRE_AUTH_REJECTED', lockMessage(locked))
    if (!user || !checkPassword(user, password)) {
      const remaining = recordFailure(user)
      if (user && remaining === 0) {
        return sendError(res, 403, 'PRE_AUTH_REJECTED', lockMessage(lockRemainingMs(user)))
      }
      return sendError(res, 401, 'INVALID_CREDENTIALS', 'Incorrect email or password')
    }
    if (user.status !== 'ACTIVE') {
      return sendError(res, 403, 'PRE_AUTH_REJECTED', 'This account is suspended. Contact GoMingle support.')
    }
    recordSuccess(user)
    res.json({ ...issueTokens(user, PARTNER_AUDIENCE), user: identity(user) })
  })

  r.post(`${BASE}/refresh`, (req, res) => {
    const { refreshToken } = jsonBody(req)
    const record = consumeRefreshToken(refreshToken, PARTNER_AUDIENCE)
    const user = record && findUserById(record.userId)
    if (!user || user.status !== 'ACTIVE') return sendError(res, 401, 'REFRESH_FAILED', 'Session expired')
    res.json({ ...issueTokens(user, PARTNER_AUDIENCE), user: identity(user) })
  })

  r.post(`${BASE}/logout`, (req, res) => {
    const { claims } = verifyAccessToken(bearer(req), PARTNER_AUDIENCE)
    if (claims) revokeUserRefreshTokens(claims.sub)
    res.status(204).end()
  })

  r.post(`${BASE}/forgot-password`, (req, res) => {
    const { email } = jsonBody(req)
    if (findUser(email, 'partner')) issueCode('partner-reset', email)
    res.status(204).end()
  })

  r.post(`${BASE}/confirm-forgot-password`, (req, res) => {
    const { email, code, newPassword } = jsonBody(req)
    const user = findUser(email, 'partner')
    const result = checkCode('partner-reset', email, String(code ?? ''))
    if (!user || result === 'expired') return sendError(res, 400, 'CODE_EXPIRED', 'Code expired')
    if (result === 'mismatch') return sendError(res, 400, 'CODE_MISMATCH', 'Incorrect code')
    if (!meetsPasswordPolicy(newPassword)) return sendError(res, 400, 'INVALID_PASSWORD', 'Weak password')
    clearCode('partner-reset', email)
    setPassword(user, newPassword)
    recordSuccess(user)
    revokeUserRefreshTokens(user.id)
    res.status(204).end()
  })

  r.post(`${BASE}/change-password`, (req, res) => {
    const user = requirePartner(req, res)
    if (!user) return
    const { currentPassword, newPassword } = jsonBody(req)
    if (!checkPassword(user, currentPassword)) {
      return sendError(res, 400, 'INVALID_CREDENTIALS', 'Current password is incorrect')
    }
    if (newPassword === currentPassword) return sendError(res, 400, 'SAME_PASSWORD', 'Same password')
    if (!meetsPasswordPolicy(newPassword)) return sendError(res, 400, 'INVALID_PASSWORD', 'Weak password')
    setPassword(user, newPassword)
    res.status(204).end()
  })

  return r
}

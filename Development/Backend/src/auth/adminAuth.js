import crypto from 'node:crypto'
import express from 'express'
import { jsonBody, sendError } from '../http.js'
import {
  checkCode,
  checkPassword,
  clearCode,
  findUser,
  findUserById,
  issueCode,
  lockRemainingMs,
  meetsPasswordPolicy,
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
 * Admin Panel authentication — /admin/api/v1/auth/*.
 *
 * Login, refresh, logout, profile (/me), change password, forgot-password
 * (OTP) and the lockout audit (record-login-result: 5 failures → 15-minute lock).
 */

export const ADMIN_AUDIENCE = 'gomingle-admin'
const BASE = '/api/v1/auth'
const resetSessions = new Map() // token -> { userId, expiresAt }

function profile(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
  }
}

function lockedResponse(res, user) {
  const unlocksAt = new Date(Date.now() + lockRemainingMs(user)).toISOString()
  sendError(res, 423, 'ERR_ACCOUNT_LOCKED', 'Account temporarily locked', { unlocksAt })
}

/** Resolves the signed-in admin from the Bearer token, or sends 401/403. */
export function requireAdmin(req, res) {
  const { claims, error } = verifyAccessToken(bearer(req), ADMIN_AUDIENCE)
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

export function adminAuthRouter() {
  const r = express.Router()

  r.post(`${BASE}/login`, (req, res) => {
    const { email, password } = jsonBody(req)
    const user = findUser(email, 'admin')
    if (user && lockRemainingMs(user)) return lockedResponse(res, user)
    if (!user || !checkPassword(user, password)) {
      return sendError(res, 401, 'ERR_INVALID_CREDENTIALS', 'Invalid email or password')
    }
    if (user.status !== 'ACTIVE') return sendError(res, 403, 'ERR_ACCOUNT_SUSPENDED', 'Account suspended')
    recordSuccess(user)
    res.json({ ...issueTokens(user, ADMIN_AUDIENCE), user: profile(user) })
  })

  // Lockout audit — the admin client calls this after every sign-in attempt.
  r.post(`${BASE}/record-login-result`, (req, res) => {
    const { email, succeeded } = jsonBody(req)
    const user = findUser(email, 'admin')
    if (succeeded) {
      if (user) recordSuccess(user)
      return res.json({ locked: false, remainingAttempts: 5 })
    }
    if (user && lockRemainingMs(user)) return lockedResponse(res, user)
    const remainingAttempts = recordFailure(user)
    if (user && remainingAttempts === 0) return lockedResponse(res, user)
    res.json({ locked: false, remainingAttempts })
  })

  r.post(`${BASE}/refresh`, (req, res) => {
    const { refreshToken } = jsonBody(req)
    const record = consumeRefreshToken(refreshToken, ADMIN_AUDIENCE)
    const user = record && findUserById(record.userId)
    if (!user || user.status !== 'ACTIVE') {
      return sendError(res, 401, 'ERR_REFRESH_INVALID', 'Refresh token invalid or expired')
    }
    res.json(issueTokens(user, ADMIN_AUDIENCE))
  })

  r.post(`${BASE}/logout`, (req, res) => {
    const { claims } = verifyAccessToken(bearer(req), ADMIN_AUDIENCE)
    if (claims) revokeUserRefreshTokens(claims.sub)
    res.status(204).end()
  })

  r.get(`${BASE}/me`, (req, res) => {
    const user = requireAdmin(req, res)
    if (user) res.json(profile(user))
  })

  r.patch(`${BASE}/me`, (req, res) => {
    const user = requireAdmin(req, res)
    if (!user) return
    const fullName = String(jsonBody(req).fullName ?? '').trim()
    if (!fullName || fullName.length > 100) {
      return sendError(res, 400, 'ERR_VALIDATION', 'Full name is required (max 100 characters)')
    }
    user.fullName = fullName
    res.json(profile(user))
  })

  r.post(`${BASE}/change-password`, (req, res) => {
    const user = requireAdmin(req, res)
    if (!user) return
    const { currentPassword, newPassword, confirmPassword } = jsonBody(req)
    if (!checkPassword(user, currentPassword)) {
      return sendError(res, 400, 'ERR_CURRENT_PASSWORD_INCORRECT', 'Current password is incorrect')
    }
    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
      return sendError(res, 400, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match')
    }
    if (!meetsPasswordPolicy(newPassword)) {
      return sendError(res, 400, 'ERR_INVALID_PASSWORD', 'Password does not meet the policy')
    }
    setPassword(user, newPassword)
    revokeUserRefreshTokens(user.id)
    res.json({})
  })

  r.post(`${BASE}/forgot-password/request-code`, (req, res) => {
    const { email } = jsonBody(req)
    // Same answer for unknown addresses — no account enumeration.
    if (findUser(email, 'admin')) issueCode('admin-reset', email)
    res.json({ codeSentAt: new Date().toISOString() })
  })

  r.post(`${BASE}/forgot-password/verify-code`, (req, res) => {
    const { email, code } = jsonBody(req)
    const user = findUser(email, 'admin')
    const result = checkCode('admin-reset', email, String(code ?? ''))
    if (!user || result === 'mismatch') return sendError(res, 400, 'ERR_INVALID_CODE', 'Invalid code')
    if (result === 'expired') return sendError(res, 400, 'ERR_CODE_EXPIRED', 'Code expired')
    clearCode('admin-reset', email)
    const resetSessionToken = crypto.randomBytes(24).toString('base64url')
    resetSessions.set(resetSessionToken, { userId: user.id, expiresAt: Date.now() + 15 * 60_000 })
    res.json({ resetSessionToken })
  })

  r.post(`${BASE}/forgot-password/reset`, (req, res) => {
    const { resetSessionToken, newPassword, confirmPassword } = jsonBody(req)
    const session = resetSessions.get(resetSessionToken)
    const user = session && session.expiresAt > Date.now() && findUserById(session.userId)
    if (!user) return sendError(res, 400, 'ERR_RESET_SESSION_INVALID', 'Reset session expired')
    if (confirmPassword !== undefined && confirmPassword !== newPassword) {
      return sendError(res, 400, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match')
    }
    if (!meetsPasswordPolicy(newPassword)) {
      return sendError(res, 400, 'ERR_INVALID_PASSWORD', 'Password does not meet the policy')
    }
    resetSessions.delete(resetSessionToken)
    setPassword(user, newPassword)
    recordSuccess(user)
    revokeUserRefreshTokens(user.id)
    res.json({})
  })

  return r
}

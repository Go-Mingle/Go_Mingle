import crypto from 'node:crypto'
import express from 'express'
import { adminAuthRouter, requireAdmin } from './auth/adminAuth.js'
import { partnerAuthRouter, requirePartner, meetsPasswordPolicy, setPassword, PARTNER_AUDIENCE } from './auth/partnerAuth.js'
import {
  allUsers,
  checkCode,
  clearCode,
  createUser,
  findUser,
  findUserById,
  issueCode,
  meetsPasswordPolicy as passwordOk,
  normaliseEmail,
  touchUser,
} from './auth/users.js'
import { revokeUserRefreshTokens } from './auth/tokens.js'
import { describeTarget, recordChange } from './changeLog.js'

const allPartnerUsers = () => allUsers().filter((u) => u.portal === 'partner')
import { issueTokens } from './auth/tokens.js'
import { admin, signup } from './contracts/registry.js'
import { resolveContract, sendFetchResponse, toFetchRequest } from './contracts/dispatch.js'
import { jsonBody, sendError } from './http.js'
import { config } from './config.js'
import { db } from './db/store.js'
import * as escrow from './payments/escrow.js'
import { gateway as safepayGateway } from './payments/safepay.js'
import { BANKS, publicPayoutAccount, savePayoutAccount } from './payments/payoutSetup.js'
import {
  adminStore,
  interestTableRestaurant,
  isSuspended,
  persistState,
  syncInterestTables,
  notifyPartner,
  onAdminRestaurantChange,
  onApproved,
  onDeclined,
  onSubmitted,
  partnerDocuments,
  partnerGallery,
  partnerTenant,
  routeFor,
  snapshot,
} from './integration.js'

function notFound(res, req) {
  sendError(res, 404, 'ERR_NOT_FOUND', `No route for ${req.method} ${req.originalUrl}`)
}

/** Resolves against a contract and sends the response; returns a copy (or null when no route matched). */
async function serve(req, res, handlers, override) {
  const response = await resolveContract(handlers, await toFetchRequest(req, req.url, override))
  if (!response) {
    notFound(res, req)
    return null
  }
  const copy = response.clone()
  await sendFetchResponse(res, response)
  return copy
}

const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next)

const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/
function trustedOrigin(origin) {
  return Boolean(origin) && (LOCAL_ORIGIN.test(origin) || config.corsOrigins.includes(origin))
}

// ════════════════════════════════════════════════════════════════════════════
// Admin Panel — /admin/*
// ════════════════════════════════════════════════════════════════════════════

const APPROVE = /^\/api\/v1\/admin\/approvals\/([^/]+)\/approve$/
const DECLINE = /^\/api\/v1\/admin\/approvals\/([^/]+)\/decline$/
const RESTAURANT_ACTION = /^\/api\/v1\/restaurants\/([^/]+)\/(suspend|unsuspend|category)$/
const RESTAURANT_MEDIA = /^\/api\/v1\/restaurants\/([^/]+)\/media$/

/** Admin media tabs for a partner restaurant: what the partner actually uploaded. */
async function partnerMediaForAdmin(restaurantId, kind) {
  if (kind === 'DOCUMENT') {
    return (await partnerDocuments(restaurantId)).map((d, i) => ({
      kind: 'DOCUMENT',
      name: d.name,
      contentType: d.type === 'PDF' ? 'application/pdf' : `image/${String(d.type ?? 'jpeg').toLowerCase()}`,
      sortOrder: i,
      url: d.url,
    }))
  }
  const gallery = await partnerGallery(restaurantId)
  const list = kind === 'VIDEO' ? gallery.videos : gallery.photos
  return list.map((m, i) => ({
    kind,
    name: m.name ?? m.mediaId,
    contentType: kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg',
    sortOrder: m.sortOrder ?? i,
    url: m.url ?? '',
    ...(m.thumbnailUrl ? { thumbnailUrl: m.thumbnailUrl } : {}),
  }))
}

const fmtPkr = (n) => `PKR ${Number(n).toLocaleString('en-PK', { maximumFractionDigits: 2 })}`

/** Admin escrow console: Safepay holds, escrow balance, releases and refunds. */
async function adminEscrow(req, res) {
  const by = req.adminUser?.fullName ?? 'Admin'
  try {
    if (req.method === 'GET' && req.path === '/api/v1/escrow') {
      return res.json({
        success: true,
        data: {
          gateway: safepayGateway,
          summary: escrow.summary(),
          items: escrow.list({ status: req.query.status || undefined }),
          restaurants: admin.mockRestaurants
            .filter((r) => r.status === 'ACTIVE')
            .map((r) => ({ id: r.id, name: r.name, hasPayoutAccount: Boolean(escrow.payoutAccount(r.id)) })),
        },
      })
    }
    if (req.method === 'POST' && req.path === '/api/v1/escrow/test-booking') {
      const body = jsonBody(req)
      if (!admin.mockRestaurants.some((r) => r.id === body.restaurantId)) {
        return sendError(res, 422, 'ERR_VALIDATION', 'Choose a restaurant.')
      }
      const item = await escrow.createHold({
        restaurantId: body.restaurantId,
        minglerName: String(body.minglerName ?? '').trim() || 'Test Mingler',
        guests: body.guests ?? 2,
        amountPerGuest: body.amountPerGuest ?? 3000,
        eventName: body.eventName,
        by: `${by} (sandbox test booking)`,
      })
      return res.status(201).json({ success: true, data: item })
    }
    const m = req.path.match(/^\/api\/v1\/escrow\/([^/]+)\/(capture|void|release|refund)$/)
    if (req.method === 'POST' && m) {
      const [, id, action] = m
      const reason = String(jsonBody(req).reason ?? '').trim() || undefined
      const item =
        action === 'capture'
          ? await escrow.capture(id, by)
          : action === 'void'
            ? await escrow.voidHold(id, by, reason)
            : action === 'refund'
              ? await escrow.refund(id, by, reason)
              : escrow.release(id, by)
      if (action === 'capture') {
        await notifyPartner(item.restaurantId, {
          type: 'ESCROW_FUNDED',
          title: 'Payment held in escrow',
          body: `${fmtPkr(item.amount)} for ${item.eventName} (${item.bookingRef}) is held in Safepay escrow until the event is completed.`,
          deepLink: '/finances',
          metadata: { escrowId: id },
        })
      }
      if (action === 'release') {
        await notifyPartner(item.restaurantId, {
          type: 'PAYOUT_RELEASED',
          title: 'Payout released',
          body: `${fmtPkr(item.payout.amount)} for ${item.bookingRef} was released from escrow to ${item.payout.bank} ${item.payout.ibanMasked} (GoMingle fee ${fmtPkr(item.payout.platformFee)}).`,
          deepLink: '/finances',
          metadata: { escrowId: id, reference: item.payout.reference },
        })
      }
      return res.json({ success: true, data: item })
    }
    return sendError(res, 404, 'ERR_NOT_FOUND', 'Unknown escrow route.')
  } catch (err) {
    if (err instanceof escrow.EscrowError) return sendError(res, err.status, err.code, err.message)
    if (err.safepay) return sendError(res, 502, 'ERR_GATEWAY', `Safepay: ${err.message}`)
    throw err
  }
}

// ── Admin users ↔ sign-in accounts ─────────────────────────────────────────

const USERS = '/api/v1/users'
const USER = /^\/api\/v1\/users\/([^/]+)(\/change-password)?$/
const ROLE = /^\/api\/v1\/roles\/([^/]+)$/

/** The role as the sign-in account carries it (with permissions, for /auth/me). */
function roleFor(roleId) {
  const role = adminStore('mockRoles').find((r) => r.id === roleId)
  return role ? { id: role.id, name: role.name, permissions: role.permissions ?? [], fullAccess: Boolean(role.fullAccess) } : null
}

/** The Users-screen record behind a sign-in account. */
function adminRecordFor(user) {
  return adminStore('mockUsers').find((u) => normaliseEmail(u.email) === user.email) ?? null
}

/** Checks a Users-screen request before it runs; sends an error and returns false when it must not. */
function precheckAdminUsers(req, res) {
  const body = jsonBody(req)
  let m
  if (req.method === 'POST' && req.path === USERS) {
    const email = normaliseEmail(body.email)
    const existing = email && allUsers().find((u) => u.email === email && u.status !== 'DELETED')
    if (existing) {
      sendError(res, 409, 'ERR_EMAIL_IN_USE', 'Email already in use.')
      return false
    }
    if (!passwordOk(body.password)) {
      sendError(res, 422, 'ERR_INVALID_PASSWORD', 'Password must be at least 8 characters with upper and lower case letters, a number and a symbol.')
      return false
    }
    if (body.confirmPassword !== undefined && body.confirmPassword !== body.password) {
      sendError(res, 422, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match.')
      return false
    }
  }
  if (req.method === 'POST' && (m = req.path.match(USER)) && m[2]) {
    if (body.confirmNewPassword !== undefined && body.confirmNewPassword !== body.newPassword) {
      sendError(res, 422, 'ERR_PASSWORD_MISMATCH', 'Passwords do not match.')
      return false
    }
    if (!passwordOk(body.newPassword)) {
      sendError(res, 422, 'ERR_INVALID_PASSWORD', 'Password must be at least 8 characters with upper and lower case letters, a number and a symbol.')
      return false
    }
  }
  return true
}

/** Keeps the sign-in accounts in step with what the Users and Roles screens changed. */
function syncAdminAccounts(req, before) {
  const body = jsonBody(req)
  let m
  if (req.method === 'POST' && req.path === USERS) {
    const email = normaliseEmail(body.email)
    const record = adminStore('mockUsers').find((u) => normaliseEmail(u.email) === email)
    if (!record) return
    const deleted = allUsers().find((u) => u.email === email)
    const fields = {
      fullName: record.fullName,
      role: roleFor(record.roleId),
      roleName: record.role?.name,
      status: record.status ?? 'ACTIVE',
    }
    if (deleted) {
      Object.assign(deleted, fields, { portal: 'admin', failures: 0, lockedUntil: 0 })
      setPassword(deleted, body.password)
    } else {
      createUser({ email, password: body.password, portal: 'admin', ...fields })
    }
    return
  }
  if ((m = req.path.match(USER))) {
    const email = before?.email ?? adminStore('mockUsers').find((u) => u.id === decodeURIComponent(m[1]))?.email
    const account = email && findUser(email, 'admin')
    if (!account) return
    if (m[2]) {
      setPassword(account, body.newPassword)
      revokeUserRefreshTokens(account.id)
      return
    }
    if (req.method === 'DELETE') {
      account.status = 'DELETED'
      revokeUserRefreshTokens(account.id)
    } else {
      const record = adminStore('mockUsers').find((u) => u.id === decodeURIComponent(m[1]))
      if (record) {
        account.fullName = record.fullName
        account.role = roleFor(record.roleId)
        account.roleName = record.role?.name
        account.status = record.status
        if (record.status !== 'ACTIVE') revokeUserRefreshTokens(account.id)
      }
    }
    touchUser()
    return
  }
  if ((m = req.path.match(ROLE)) && req.method === 'PATCH') {
    const role = roleFor(decodeURIComponent(m[1]))
    for (const account of allUsers()) {
      if (account.portal === 'admin' && account.role?.id === role?.id) {
        account.role = role
        account.roleName = role.name
      }
    }
    touchUser()
  }
}

export function adminPortal() {
  const r = express.Router()
  // Renaming yourself (profile menu) renames your row on the Users screen too.
  r.use((req, res, next) => {
    if (req.method === 'PATCH' && req.path === '/api/v1/auth/me') {
      const account = requireAdminSilently(req)
      res.on('finish', () => {
        const fullName = String(jsonBody(req).fullName ?? '').trim()
        if (res.statusCode !== 200 || !account || !fullName) return
        const record = adminRecordFor(account)
        if (record) record.fullName = fullName
        touchUser()
        persistState()
      })
    }
    next()
  })
  r.use(adminAuthRouter())
  r.use(
    wrap(async (req, res) => {
      if (req.path.startsWith('/api')) {
        const adminUser = requireAdmin(req, res)
        if (!adminUser) return
        req.adminUser = adminUser
        admin.setMockCurrentUserId(adminRecordFor(adminUser)?.id ?? null)
      }
      const mutation = req.method !== 'GET' && req.method !== 'HEAD'
      const audit = (result, target) =>
        mutation && recordChange({ method: req.method, path: req.path, body: jsonBody(req), adminUser: req.adminUser, target, result })

      let m
      if (req.path.startsWith('/api/v1/escrow')) {
        await adminEscrow(req, res)
        if (mutation && res.statusCode < 400) audit(null, null)
        return
      }
      if (req.method === 'POST' && (m = req.path.match(APPROVE))) {
        const { categoryId } = jsonBody(req)
        if (!categoryId) return sendError(res, 422, 'ERR_VALIDATION', 'Choose a category to approve.')
        const id = decodeURIComponent(m[1])
        const data = await onApproved(id, categoryId)
        if (!data) return sendError(res, 404, 'ERR_APPLICATION_NOT_FOUND', 'Application not found.')
        if (data.error) return sendError(res, 422, 'ERR_CATEGORY_NOT_FOUND', 'Choose an existing category.')
        audit({ name: adminStore('mockRestaurants').find((x) => x.id === id)?.name }, null)
        return res.json({ success: true, data })
      }
      if (req.method === 'POST' && (m = req.path.match(DECLINE))) {
        const reason = String(jsonBody(req).reason ?? '').trim()
        if (!reason) return sendError(res, 422, 'ERR_VALIDATION', 'A reason is required to decline.')
        const id = decodeURIComponent(m[1])
        const data = await onDeclined(id, reason)
        if (!data) return sendError(res, 404, 'ERR_APPLICATION_NOT_FOUND', 'Application not found.')
        audit({ name: adminStore('mockRestaurants').find((x) => x.id === id)?.name }, null)
        return res.json({ success: true, data })
      }

      if (req.method === 'GET' && (m = req.path.match(RESTAURANT_MEDIA)) && db.restaurants[decodeURIComponent(m[1])]) {
        const kind = String(req.query.kind ?? 'PHOTO')
        if (!['DOCUMENT', 'PHOTO', 'VIDEO'].includes(kind)) {
          return sendError(res, 400, 'ERR_VALIDATION', 'Invalid media kind.')
        }
        return res.json({ success: true, data: { items: await partnerMediaForAdmin(decodeURIComponent(m[1]), kind) } })
      }

      if (mutation && !precheckAdminUsers(req, res)) return
      const target = mutation ? describeTarget(req.path) : null
      const itRestaurant = mutation ? interestTableRestaurant(req.path) : null

      const response = await serve(req, res, admin.handlers)
      if (!response?.ok || !mutation) return
      const result = await response.json().then((j) => j?.data ?? j, () => null)

      if (req.path.startsWith(USERS) || req.path.startsWith('/api/v1/roles')) syncAdminAccounts(req, target?.record)
      if ((m = req.path.match(RESTAURANT_ACTION))) {
        const change = m[2] === 'suspend' ? 'suspended' : m[2] === 'unsuspend' ? 'unsuspended' : 'category'
        await onAdminRestaurantChange(decodeURIComponent(m[1]), change, jsonBody(req))
      }
      if (itRestaurant) await syncInterestTables(itRestaurant)
      audit(result, target)
      persistState()
    }),
  )
  return r
}

/** The signed-in admin for a request, without sending an error. */
function requireAdminSilently(req) {
  const sink = { status: () => sink, json: () => sink, setHeader: () => sink, end: () => sink }
  return requireAdmin(req, sink)
}

// ════════════════════════════════════════════════════════════════════════════
// Partner Portal — /partner/*
// ════════════════════════════════════════════════════════════════════════════

const SIGNUP = {
  start: '/api/v1/partner/signup/start',
  resend: '/api/v1/partner/signup/resend',
  verify: '/api/v1/partner/signup/verify',
  complete: '/api/v1/partner/signup/complete',
}
/** The code and "already registered" address the partner contract recognises. */
const CONTRACT_SIGNUP_CODE = '123456'
const CONTRACT_REGISTERED_EMAIL = 'partner@gomingle.com'
const contractSignupTokens = new Map() // userId -> token the contract expects on `complete`

const SESSION_PATH = '/api/v1/partner/session'
const PAYOUT_ACCOUNT = '/api/v1/partner/restaurant/payout-account'
const PROFILE_ROOT = '/api/v1/partner/restaurant'
const SUBMIT_PATH = `${PROFILE_ROOT}/submit`
const ONBOARDING_LINK = `${PROFILE_ROOT}/payments/onboarding-link`
const AMENITIES = `${PROFILE_ROOT}/amenities`
const AMENITY = /^\/api\/v1\/partner\/restaurant\/amenities\/([^/]+)$/
const TEAM = '/api/v1/partner/users'
const ACCOUNT = '/api/v1/partner/me'

/** A team member's designation, from the team list the owner manages. */
function teamDesignation(ns, user) {
  return ns.users.mockPartnerUsers.find((u) => u.id === user.teamMemberId)?.designation ?? ''
}

/** After a rename on the account screen: the sign-in account and the team list follow. */
function syncAccountName(ns, user) {
  const profile = ns.account.mockPartnerProfile
  if (profile.fullName) user.fullName = profile.fullName
  if (profile.designation !== undefined) user.designation = profile.designation
  touchUser()
  const row = user.teamMemberId
    ? ns.users.mockPartnerUsers.find((u) => u.id === user.teamMemberId)
    : ns.users.mockPartnerUsers.find((u) => u.isPrimary)
  if (row) {
    row.fullName = user.fullName
    if (profile.designation) row.designation = profile.designation
  }
}
const TEAM_MEMBER = /^\/api\/v1\/partner\/users\/([^/]+)(\/set-password)?$/

/** Team members a partner adds can sign in to the same restaurant. */
async function syncTeamAccount(req, response, owner) {
  const body = jsonBody(req)
  const data = (await response.json().catch(() => ({})))?.data ?? {}
  let m
  if (req.method === 'POST' && req.path === TEAM) {
    const email = normaliseEmail(body.email)
    if (!email || findUser(email, 'partner')) return
    createUser({
      email,
      fullName: String(body.fullName ?? email).trim(),
      password: body.password,
      portal: 'partner',
      restaurantId: owner.restaurantId,
      teamMemberId: data.id ?? data.user?.id,
    })
    return
  }
  if (!(m = req.path.match(TEAM_MEMBER))) return
  const member = allPartnerUsers().find((u) => u.restaurantId === owner.restaurantId && u.teamMemberId === m[1])
  if (!member) return
  if (m[2] && body.password) setPassword(member, body.password)
  else if (req.method === 'DELETE') member.status = 'DELETED'
  else if (body.status === 'SUSPENDED' || body.status === 'ACTIVE') member.status = body.status
  touchUser()
}

function rewriteTokens(node, tokens) {
  if (!node || typeof node !== 'object') return
  for (const key of Object.keys(node)) {
    if (key === 'accessToken' || key === 'idToken') node[key] = tokens.accessToken
    else if (key === 'refreshToken') node[key] = tokens.refreshToken
    else if (key === 'expiresIn') node[key] = tokens.expiresIn
    else rewriteTokens(node[key], tokens)
  }
}

function findAccessToken(node) {
  if (!node || typeof node !== 'object') return null
  if (typeof node.accessToken === 'string') return node.accessToken
  for (const value of Object.values(node)) {
    const found = findAccessToken(value)
    if (found) return found
  }
  return null
}

const newRestaurantId = () => `rest-${crypto.randomBytes(3).toString('hex')}`

/** Sign-up: real one-time codes, a real account and a new restaurant of its own. */
async function signupRoute(req, res) {
  const body = jsonBody(req)
  const json = (value) => Buffer.from(JSON.stringify(value))

  if (req.path === SIGNUP.start || req.path === SIGNUP.resend) {
    const email = normaliseEmail(body.email)
    if (req.path === SIGNUP.start && findUser(email, 'partner')?.passwordHash) {
      await serve(req, res, signup.handlers, { body: json({ ...body, email: CONTRACT_REGISTERED_EMAIL }) })
      return
    }
    if (email) issueCode('partner-signup', email)
    await serve(req, res, signup.handlers)
    return
  }

  if (req.path === SIGNUP.verify) {
    const email = normaliseEmail(body.email)
    const ok = checkCode('partner-signup', email, String(body.code ?? '')) === 'ok'
    const request = await toFetchRequest(req, req.url, {
      body: json({ ...body, code: ok ? CONTRACT_SIGNUP_CODE : '000000-invalid' }),
    })
    const response = await resolveContract(signup.handlers, request)
    if (!response) return notFound(res, req)
    if (!response.ok) return sendFetchResponse(res, response)
    const payload = await response.json()
    clearCode('partner-signup', email)

    let user = findUser(email, 'partner')
    if (!user) {
      user = createUser({ email, fullName: email.split('@')[0], portal: 'partner', restaurantId: newRestaurantId() })
    }
    const ns = await partnerTenant(user.restaurantId)
    const original = findAccessToken(payload)
    if (original) contractSignupTokens.set(user.id, original)
    rewriteTokens(payload, issueTokens(user, PARTNER_AUDIENCE))
    const restaurant = payload?.data?.session?.restaurant ?? payload?.data?.restaurant
    if (restaurant) Object.assign(restaurant, { id: user.restaurantId, status: ns.profile.mockProfile.status })
    res.status(response.status).json(payload)
    return
  }

  // complete — set the password on the new account
  const user = requirePartner(req, res)
  if (!user) return
  if (!meetsPasswordPolicy(body.password)) {
    return sendError(res, 422, 'ERR_VALIDATION', 'Password does not meet the policy')
  }
  setPassword(user, body.password)
  if (body.fullName) {
    user.fullName = String(body.fullName).trim()
    touchUser()
  }
  const token = contractSignupTokens.get(user.id) ?? ''
  contractSignupTokens.delete(user.id)
  await serve(req, res, signup.handlers, { headers: { authorization: `Bearer ${token}` } })
}

/** Amenities: the partner picks from the platform catalogue the Admin Panel manages. */
function listAmenities(res, restaurantId) {
  const selected = new Set(db.restaurants[restaurantId]?.amenityIds ?? [])
  const items = [...admin.mockAmenities]
    .map((a) => ({
      amenityId: a.id,
      name: a.name,
      iconUrl: `${config.publicUrl}/amenity-icons/${encodeURIComponent(a.id)}.svg`,
      selected: selected.has(a.id),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
  res.json({ success: true, data: { items } })
}

function setAmenity(req, res, restaurantId, ns, amenityId) {
  if (ns.profile.mockProfile.status === 'PENDING') {
    return sendError(res, 409, 'ERR_PROFILE_READ_ONLY', "Your application is under review and can't be edited right now.", {
      status: 'PENDING',
    })
  }
  const { selected } = jsonBody(req)
  if (typeof selected !== 'boolean') return sendError(res, 422, 'ERR_VALIDATION', 'Invalid request.')
  if (!admin.mockAmenities.some((a) => a.id === amenityId)) return sendError(res, 404, 'ERR_NOT_FOUND', 'Amenity not found.')
  const rec = db.restaurants[restaurantId]
  const ids = new Set(rec.amenityIds ?? [])
  if (selected) ids.add(amenityId)
  else ids.delete(amenityId)
  rec.amenityIds = [...ids]
  snapshot(restaurantId, ns)
  res.json({ success: true, data: { amenityId, selected } })
}

export function partnerPortal() {
  const r = express.Router()
  r.use(partnerAuthRouter())
  r.use(
    wrap(async (req, res) => {
      if (Object.values(SIGNUP).includes(req.path)) return signupRoute(req, res)
      if (!req.path.startsWith('/api')) return notFound(res, req)

      const user = requirePartner(req, res)
      if (!user) return
      if (!user.restaurantId) {
        user.restaurantId = newRestaurantId()
        touchUser()
      }
      const id = user.restaurantId
      const ns = await partnerTenant(id)
      let m

      if (req.method === 'GET' && req.path === SESSION_PATH) {
        const p = ns.profile.mockProfile
        ns.session.partnerSessionState.route = routeFor(p.status)
        ns.session.partnerSessionState.payoutReady = Boolean(p.payoutAccountId)
        const response = await resolveContract(ns.handlers, await toFetchRequest(req, req.url))
        if (!response?.ok) return response ? sendFetchResponse(res, response) : notFound(res, req)
        const payload = await response.json()
        const data = payload.data ?? payload
        data.route = routeFor(p.status)
        data.partnerUser = { ...data.partnerUser, id: user.id, email: user.email, fullName: user.fullName }
        if (data.restaurant) Object.assign(data.restaurant, { id, name: p.name ?? data.restaurant.name, status: p.status })
        return res.status(response.status).json(payload)
      }
      if (req.path === PAYOUT_ACCOUNT) {
        // The restaurant's payout bank account, managed on the profile's Payout
        // Account tab. Editable in every state: bank details are not part of the
        // profile under review, and escrow is released to whatever is on file.
        if (req.method === 'GET') {
          return res.json({
            success: true,
            data: { account: publicPayoutAccount(escrow.payoutAccount(id)), banks: BANKS },
          })
        }
        if (req.method === 'PUT') {
          const result = await savePayoutAccount(id, jsonBody(req))
          if (result.error) {
            return sendError(res, 422, 'ERR_VALIDATION', result.error, { field: result.field })
          }
          return res.json({ success: true, data: { account: publicPayoutAccount(result.account), banks: BANKS } })
        }
      }
      if (req.method === 'GET' && req.path === '/api/v1/partner/escrow') {
        const account = escrow.payoutAccount(id)
        return res.json({
          success: true,
          data: {
            gateway: safepayGateway,
            summary: escrow.summary(id),
            payoutAccount: account
              ? { accountTitle: account.accountTitle, bankName: account.bankName, iban: escrow.maskIban(account.iban) }
              : null,
            items: escrow.list({ restaurantId: id }),
          },
        })
      }
      if (req.method === 'GET' && req.path === AMENITIES) return listAmenities(res, id)
      if (req.method === 'PUT' && (m = req.path.match(AMENITY))) return setAmenity(req, res, id, ns, decodeURIComponent(m[1]))
      if (req.method === 'POST' && req.path === ONBOARDING_LINK) {
        let origin = req.headers.origin
        if (!origin && req.headers.referer) origin = new URL(req.headers.referer).origin
        const back = trustedOrigin(origin) ? `?return=${encodeURIComponent(origin)}` : ''
        return res.json({
          success: true,
          data: {
            url: `${config.publicUrl}/payouts/setup/${encodeURIComponent(id)}${back}`,
            mode: ns.profile.mockProfile.payoutAccountId ? 'UPDATE' : 'ONBOARDING',
          },
        })
      }

      // A suspended restaurant cannot put itself back on the Mingler app.
      if (req.method === 'PATCH' && req.path === PROFILE_ROOT && jsonBody(req).visibleOnApp === true && isSuspended(id)) {
        return sendError(res, 409, 'ERR_RESTAURANT_SUSPENDED', 'GoMingle has suspended your restaurant. Contact GoMingle to be reactivated.')
      }
      // The account screen shows whoever is signed in (owner or team member).
      if (req.path === ACCOUNT) {
        Object.assign(ns.account.mockPartnerProfile, {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          designation: user.designation ?? (user.teamMemberId ? teamDesignation(ns, user) : 'Owner'),
          isPrimary: !user.teamMemberId,
        })
      }

      const response = await serve(req, res, ns.handlers)
      if (!response?.ok || req.method === 'GET') return
      if (req.path === ACCOUNT) syncAccountName(ns, user)
      if (req.path.startsWith(TEAM)) await syncTeamAccount(req, response, user)
      if (req.path.startsWith(PROFILE_ROOT)) snapshot(id, ns)
      if (req.path === SUBMIT_PATH) await onSubmitted(id)
      persistState()
    }),
  )
  return r
}

// ════════════════════════════════════════════════════════════════════════════
// Uploads / media (/t/<restaurant>/mock-*), admin uploads, amenity icons
// ════════════════════════════════════════════════════════════════════════════

export function assetRoutes(phosphorDir) {
  const r = express.Router()

  r.all(
    /^\/t\/([^/]+)\/mock-(cdn|stream|upload|menu-upload)\//,
    wrap(async (req, res) => {
      const key = decodeURIComponent(req.params[0])
      const ns = key === 'signup' ? signup : await partnerTenant(key)
      const response = await resolveContract(ns.handlers, await toFetchRequest(req, req.originalUrl))
      if (!response) return notFound(res, req)
      await sendFetchResponse(res, response)
      if (req.method !== 'GET' && key !== 'signup') snapshot(key, ns)
      if (req.method !== 'GET') persistState()
    }),
  )

  r.all(
    /^\/mock-bucket\//,
    wrap(async (req, res) => {
      const response = await resolveContract(admin.handlers, await toFetchRequest(req, req.originalUrl))
      if (!response) return notFound(res, req)
      await sendFetchResponse(res, response)
      if (req.method !== 'GET') persistState()
    }),
  )

  // Amenity icons for the partner catalogue: the admin's custom SVG, or the
  // Phosphor icon the admin picked for it.
  r.get('/amenity-icons/:file', (req, res) => {
    const id = req.params.file.replace(/\.svg$/, '')
    const amenity = admin.mockAmenities.find((a) => a.id === id)
    if (!amenity) return res.status(404).end()
    const icon = String(amenity.iconUrl ?? '').trim()
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
    if (/^https?:\/\//.test(icon)) return res.redirect(icon)
    const data = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(icon)
    if (data) {
      res.setHeader('Content-Type', data[1])
      return res.send(data[2] ? Buffer.from(data[3], 'base64') : Buffer.from(decodeURIComponent(data[3])))
    }
    res.setHeader('Content-Type', 'image/svg+xml')
    if (icon.startsWith('<svg')) return res.send(icon)
    const kebab = icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() || 'star'
    res.sendFile(`${kebab}.svg`, { root: phosphorDir }, (err) => {
      if (err && !res.headersSent) res.sendFile('star.svg', { root: phosphorDir })
    })
  })

  return r
}

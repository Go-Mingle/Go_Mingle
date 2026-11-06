/**
 * End-to-end restaurant lifecycle across both portals, through the HTTP API:
 * partner sign-up → profile → photo + document → payout account (IBAN) → submit →
 * admin queue → decline → partner resubmits → admin approves → live.
 */
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.NODE_ENV = 'test'
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gm-')), 'db.json')
process.env.PORT = '4998'
process.env.PUBLIC_URL = 'http://localhost:4998'
const { app } = await import('../src/server.js')

const base = 'http://localhost:4998'
let server

async function call(method, url, { body, token, raw, contentType } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (raw) headers['Content-Type'] = contentType
  const res = await fetch(url.startsWith('http') ? url : base + url, {
    method,
    headers,
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  })
  const text = await res.text()
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = text
  }
  return { status: res.status, json }
}

async function upload(token, kind, name, contentType, bytes) {
  const plural = kind === 'document' ? 'documents' : 'photos'
  const target = await call('POST', `/partner/api/v1/partner/restaurant/${plural}/upload-url`, {
    token,
    body: { name, contentType, size: bytes.length },
  })
  assert.equal(target.status, 200, JSON.stringify(target.json))
  const { uploadUrl, uploadRef } = target.json.data
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: bytes })
  assert.equal(put.status, 200)
  const commit = await call('POST', `/partner/api/v1/partner/restaurant/${plural}`, { token, body: { uploadRef } })
  assert.ok(commit.status < 300, JSON.stringify(commit.json))
}

before(() => new Promise((resolve) => { server = app.listen(4998, resolve) }))
after(() => new Promise((resolve) => server.close(resolve)))

describe('restaurant lifecycle', () => {
  const email = 'owner@kolachi.pk'
  let partner
  let adminToken
  let restaurantId

  it('partner signs up and lands in profile setup', async () => {
    assert.equal((await call('POST', '/partner/api/v1/partner/signup/start', { body: { email } })).status, 200)
    const verify = await call('POST', '/partner/api/v1/partner/signup/verify', { body: { email, code: '123456' } })
    assert.equal(verify.status, 201)
    partner = verify.json.data.session.accessToken
    const done = await call('POST', '/partner/api/v1/partner/signup/complete', { token: partner, body: { password: 'Kolachi@2026' } })
    assert.equal(done.status, 200)
    const session = await call('GET', '/partner/api/v1/partner/session', { token: partner })
    assert.equal(session.json.data.route, 'PROFILE_SETUP')
    restaurantId = session.json.data.restaurant.id
    assert.match(restaurantId, /^rest-/)
  })

  it('starts with an empty profile, not the demo restaurant', async () => {
    const profile = await call('GET', '/partner/api/v1/partner/restaurant', { token: partner })
    assert.equal(profile.json.data.name, null)
    const docs = await call('GET', '/partner/api/v1/partner/restaurant/documents', { token: partner })
    assert.equal((docs.json.data.items ?? docs.json.data).length, 0)
  })

  it('cannot submit an incomplete profile', async () => {
    const submit = await call('POST', '/partner/api/v1/partner/restaurant/submit', { token: partner })
    assert.equal(submit.status, 422)
  })

  it('fills the profile, uploads a cover photo and a licence, adds a payout IBAN', async () => {
    const patch = await call('PATCH', '/partner/api/v1/partner/restaurant', {
      token: partner,
      body: {
        name: 'Kolachi',
        cuisine: 'Pakistani',
        description: 'Seafront Pakistani barbecue at Do Darya.',
        location: { areaDistrict: 'DHA Phase 8', city: 'Karachi', fullAddress: 'Do Darya, DHA Phase 8, Karachi', latitude: 24.7869, longitude: 67.0614 },
        owner: { name: 'Raees Raza', email, phone: '+923001112233' },
        restaurant: { phone: '+922135250000', email: 'hello@kolachi.pk', website: 'www.kolachi.pk' },
      },
    })
    assert.equal(patch.status, 200, JSON.stringify(patch.json))
    await upload(partner, 'photo', 'terrace.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]))
    await upload(partner, 'document', 'trade-licence.pdf', 'application/pdf', Buffer.from('%PDF-1.4 licence'))

    const link = await call('POST', '/partner/api/v1/partner/restaurant/payments/onboarding-link', { token: partner })
    assert.match(link.json.data.url, /\/payouts\/setup\//)
    const bad = await fetch(link.json.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'accountTitle=Kolachi&bankName=HBL&iban=PK00HABB0000000000000000',
    })
    assert.equal(bad.status, 422)
    const connect = await fetch(link.json.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'accountTitle=Kolachi+Pvt+Ltd&bankName=HBL&iban=PK72+HABB+0012+3456+7890+1234',
    })
    assert.equal(connect.status, 200)

    // Re-saving the form as pre-filled (masked IBAN) keeps the stored number.
    const resave = await fetch(link.json.data.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ accountTitle: 'Kolachi Restaurant (Pvt) Ltd', bankName: 'HBL', iban: 'PK72 •••• 1234' }),
    })
    assert.equal(resave.status, 200)
    const profile = await call('GET', '/partner/api/v1/partner/restaurant', { token: partner })
    assert.equal(profile.json.data.submissionReadiness.payoutConfigured, true)
  })

  it('shows and edits the payout account from the portal, never exposing the full IBAN', async () => {
    const path = '/partner/api/v1/partner/restaurant/payout-account'
    const got = await call('GET', path, { token: partner })
    assert.equal(got.status, 200)
    assert.deepEqual(
      { title: got.json.data.account.accountTitle, bank: got.json.data.account.bankName, iban: got.json.data.account.ibanMasked },
      { title: 'Kolachi Restaurant (Pvt) Ltd', bank: 'HBL', iban: 'PK72 •••• 1234' },
    )
    assert.ok(got.json.data.banks.includes('Meezan Bank'))
    assert.ok(!JSON.stringify(got.json).includes('PK72HABB0012345678901234'))

    const bad = await call('PUT', path, { token: partner, body: { accountTitle: 'X', bankName: 'HBL', iban: 'PK00HABB0000000000000000' } })
    assert.equal(bad.status, 422)
    assert.equal(bad.json.error.details.field, 'iban')
    assert.equal((await call('PUT', path, { token: partner, body: { accountTitle: 'X', bankName: 'Nope', iban: 'PK72 •••• 1234' } })).json.error.details.field, 'bankName')

    // Masked IBAN = keep the number; title and bank change.
    const kept = await call('PUT', path, { token: partner, body: { accountTitle: 'Kolachi Pvt', bankName: 'Meezan Bank', iban: 'PK72 •••• 1234' } })
    assert.equal(kept.status, 200, JSON.stringify(kept.json))
    assert.equal(kept.json.data.account.bankName, 'Meezan Bank')
    assert.equal(kept.json.data.account.ibanMasked, 'PK72 •••• 1234')

    const changed = await call('PUT', path, { token: partner, body: { accountTitle: 'Kolachi Pvt', bankName: 'Meezan Bank', iban: 'PK40MEZN0000001123456702' } })
    assert.equal(changed.json.data.account.ibanMasked, 'PK40 •••• 6702')
    // Put the original back for the later escrow assertions.
    await call('PUT', path, { token: partner, body: { accountTitle: 'Kolachi Restaurant (Pvt) Ltd', bankName: 'HBL', iban: 'PK72HABB0012345678901234' } })
  })

  it('submits for approval and appears in the admin queue with its documents', async () => {
    const submit = await call('POST', '/partner/api/v1/partner/restaurant/submit', { token: partner })
    assert.equal(submit.status, 200, JSON.stringify(submit.json))
    assert.equal((await call('GET', '/partner/api/v1/partner/session', { token: partner })).json.data.route, 'UNDER_REVIEW')

    adminToken = (await call('POST', '/admin/api/v1/auth/login', { body: { email: 'admin@gomingle.com', password: 'Admin@123' } })).json.accessToken
    const queue = await call('GET', '/admin/api/v1/admin/approvals?status=pending&page=1&pageSize=50', { token: adminToken })
    const item = queue.json.data.items.find((i) => i.id === restaurantId)
    assert.ok(item, 'new restaurant is in the approval queue')
    assert.equal(item.name, 'Kolachi')
    assert.equal(item.ownerPhone, '+92 300 111 2233')

    const detail = await call('GET', `/admin/api/v1/restaurants/${restaurantId}`, { token: adminToken })
    assert.equal(detail.status, 200)
    const docs = await call('GET', `/admin/api/v1/restaurants/${restaurantId}/media?kind=DOCUMENT`, { token: adminToken })
    assert.deepEqual(docs.json.data.items.map((d) => d.name), ['trade-licence.pdf'])
    const photos = await call('GET', `/admin/api/v1/restaurants/${restaurantId}/media?kind=PHOTO`, { token: adminToken })
    assert.equal(photos.json.data.items.length, 1)

    const inbox = await call('GET', '/admin/api/v1/notifications?page=1&pageSize=10', { token: adminToken })
    assert.match(JSON.stringify(inbox.json), /Kolachi/)
  })

  it('is read-only for the partner while under review', async () => {
    const patch = await call('PATCH', '/partner/api/v1/partner/restaurant', { token: partner, body: { name: 'Changed' } })
    assert.equal(patch.status, 409)
  })

  it('admin declines → partner sees the reason and can resubmit', async () => {
    const decline = await call('POST', `/admin/api/v1/admin/approvals/${restaurantId}/decline`, {
      token: adminToken,
      body: { reason: 'Please upload the food-safety certificate.' },
    })
    assert.equal(decline.status, 200)
    const session = await call('GET', '/partner/api/v1/partner/session', { token: partner })
    assert.equal(session.json.data.route, 'REJECTED')
    const profile = await call('GET', '/partner/api/v1/partner/restaurant', { token: partner })
    assert.equal(profile.json.data.rejections[0].reason, 'Please upload the food-safety certificate.')

    await upload(partner, 'document', 'food-safety.pdf', 'application/pdf', Buffer.from('%PDF-1.4 food safety'))
    const resubmit = await call('POST', '/partner/api/v1/partner/restaurant/submit', { token: partner })
    assert.equal(resubmit.status, 200, JSON.stringify(resubmit.json))
    const queue = await call('GET', '/admin/api/v1/admin/approvals?status=pending&page=1&pageSize=50', { token: adminToken })
    assert.ok(queue.json.data.items.some((i) => i.id === restaurantId))
  })

  it('admin approves → restaurant is live in the directory and the partner gets the full portal', async () => {
    const approve = await call('POST', `/admin/api/v1/admin/approvals/${restaurantId}/approve`, { token: adminToken, body: { categoryId: 'c1' } })
    assert.equal(approve.status, 200)
    const list = await call('GET', '/admin/api/v1/restaurants?page=1&pageSize=50&q=kolachi', { token: adminToken })
    const row = list.json.data.items.find((r) => r.id === restaurantId)
    assert.equal(row.status, 'ACTIVE')
    const session = await call('GET', '/partner/api/v1/partner/session', { token: partner })
    assert.equal(session.json.data.route, 'FULL_PORTAL')
    const recent = await call('GET', '/partner/api/v1/partner/notifications?page=1&pageSize=10', { token: partner })
    assert.match(JSON.stringify(recent.json), /approved/i)
  })

  it('partner edits show up on the admin side', async () => {
    await call('PATCH', '/partner/api/v1/partner/restaurant', { token: partner, body: { description: 'Now open for late-night barbecue.' } })
    const detail = await call('GET', `/admin/api/v1/restaurants/${restaurantId}`, { token: adminToken })
    assert.match(JSON.stringify(detail.json), /late-night barbecue/)
  })

  it('amenities come from the admin catalogue and sync back', async () => {
    const list = await call('GET', '/partner/api/v1/partner/restaurant/amenities', { token: partner })
    assert.ok(list.json.data.items.length >= 10)
    await call('PUT', '/partner/api/v1/partner/restaurant/amenities/a1', { token: partner, body: { selected: true } })
    const adminAmenities = await call('GET', `/admin/api/v1/restaurants/${restaurantId}/amenities`, { token: adminToken })
    assert.deepEqual(adminAmenities.json.data.items.map((a) => a.id), ['a1'])
  })

  it('admin suspension reaches the partner inbox', async () => {
    const res = await call('POST', `/admin/api/v1/restaurants/${restaurantId}/suspend`, { token: adminToken, body: { reason: 'Health inspection pending' } })
    assert.ok(res.status < 300, JSON.stringify(res.json))
    const inbox = await call('GET', '/partner/api/v1/partner/notifications?page=1&pageSize=10', { token: partner })
    assert.match(JSON.stringify(inbox.json), /suspended/i)
  })

  it('persists accounts and restaurants to disk', async () => {
    await new Promise((r) => setTimeout(r, 300))
    const saved = JSON.parse(fs.readFileSync(process.env.DATA_FILE, 'utf8'))
    assert.ok(saved.users.some((u) => u.email === email && u.passwordHash && !('password' in u)))
    assert.equal(saved.restaurants[restaurantId].profile.name, 'Kolachi')
    assert.equal(saved.admin.restaurants[restaurantId].status, 'SUSPENDED')
  })
})

describe('partner team members', () => {
  it('a teammate added in the portal can sign in to the same restaurant', async () => {
    const owner = (await call('POST', '/partner/api/v1/partner/auth/login', { body: { email: 'partner@gomingle.com', password: 'Partner@123' } })).json.accessToken
    const add = await call('POST', '/partner/api/v1/partner/users', {
      token: owner,
      body: { fullName: 'Sana Iqbal', email: 'sana@aurelia.pk', password: 'Aurelia@2026', confirmPassword: 'Aurelia@2026' },
    })
    assert.ok(add.status < 300, JSON.stringify(add.json))
    const login = await call('POST', '/partner/api/v1/partner/auth/login', { body: { email: 'sana@aurelia.pk', password: 'Aurelia@2026' } })
    assert.equal(login.status, 200)
    const session = await call('GET', '/partner/api/v1/partner/session', { token: login.json.accessToken })
    assert.equal(session.json.data.restaurant.id, 'rest1')

    const id = add.json.data.id
    await call('PATCH', `/partner/api/v1/partner/users/${id}`, { token: owner, body: { status: 'SUSPENDED' } })
    const blocked = await call('POST', '/partner/api/v1/partner/auth/login', { body: { email: 'sana@aurelia.pk', password: 'Aurelia@2026' } })
    assert.equal(blocked.status, 403)
  })
})

describe('Safepay escrow', () => {
  let adminToken
  let owner
  before(async () => {
    adminToken = (await call('POST', '/admin/api/v1/auth/login', { body: { email: 'admin@gomingle.com', password: 'Admin@123' } })).json.accessToken
    owner = (await call('POST', '/partner/api/v1/partner/auth/login', { body: { email: 'partner@gomingle.com', password: 'Partner@123' } })).json.accessToken
  })

  it('shows the seeded escrow ledger on the Safepay sandbox', async () => {
    const res = await call('GET', '/admin/api/v1/escrow', { token: adminToken })
    assert.equal(res.status, 200)
    assert.equal(res.json.data.gateway.name, 'Safepay')
    assert.equal(res.json.data.gateway.environment, 'sandbox')
    const statuses = new Set(res.json.data.items.map((i) => i.status))
    for (const s of ['AUTHORIZED', 'IN_ESCROW', 'RELEASED', 'REFUNDED', 'VOIDED']) assert.ok(statuses.has(s), s)
  })

  it('holds → escrow → release pays the restaurant net of the fee and notifies it', async () => {
    const created = await call('POST', '/admin/api/v1/escrow/test-booking', {
      token: adminToken,
      body: { restaurantId: 'rest1', minglerName: 'Zara Ali', guests: 4, amountPerGuest: 2500 },
    })
    assert.equal(created.status, 201)
    const id = created.json.data.id
    assert.equal(created.json.data.status, 'AUTHORIZED')
    assert.equal(created.json.data.amount, 10000)

    assert.equal((await call('POST', `/admin/api/v1/escrow/${id}/release`, { token: adminToken })).status, 409)
    const captured = await call('POST', `/admin/api/v1/escrow/${id}/capture`, { token: adminToken })
    assert.equal(captured.json.data.status, 'IN_ESCROW')
    const released = await call('POST', `/admin/api/v1/escrow/${id}/release`, { token: adminToken })
    assert.equal(released.json.data.status, 'RELEASED')
    assert.equal(released.json.data.payout.amount, 9000)
    assert.equal(released.json.data.payout.platformFee, 1000)
    assert.match(released.json.data.payout.ibanMasked, /^PK40 •••• 6702$/)

    const mine = await call('GET', '/partner/api/v1/partner/escrow', { token: owner })
    assert.ok(mine.json.data.items.some((i) => i.id === id && i.status === 'RELEASED'))
    assert.ok(mine.json.data.items.every((i) => i.restaurantId === 'rest1'))
    const inbox = await call('GET', '/partner/api/v1/partner/notifications?page=1&pageSize=10', { token: owner })
    assert.match(JSON.stringify(inbox.json), /Payout released/)
  })

  it('voids an uncaptured hold and refunds captured funds with a reason', async () => {
    const a = (await call('POST', '/admin/api/v1/escrow/test-booking', { token: adminToken, body: { restaurantId: 'rest1', guests: 2, amountPerGuest: 3000 } })).json.data
    assert.equal((await call('POST', `/admin/api/v1/escrow/${a.id}/void`, { token: adminToken })).json.data.status, 'VOIDED')
    const b = (await call('POST', '/admin/api/v1/escrow/test-booking', { token: adminToken, body: { restaurantId: 'rest1', guests: 2, amountPerGuest: 3000 } })).json.data
    await call('POST', `/admin/api/v1/escrow/${b.id}/capture`, { token: adminToken })
    assert.equal((await call('POST', `/admin/api/v1/escrow/${b.id}/refund`, { token: adminToken })).status, 422)
    const refunded = await call('POST', `/admin/api/v1/escrow/${b.id}/refund`, { token: adminToken, body: { reason: 'Event cancelled' } })
    assert.equal(refunded.json.data.status, 'REFUNDED')
  })

  it('refuses to release to a restaurant without a payout account', async () => {
    const h = (await call('POST', '/admin/api/v1/escrow/test-booking', { token: adminToken, body: { restaurantId: 'rest2', guests: 2, amountPerGuest: 3000 } })).json.data
    await call('POST', `/admin/api/v1/escrow/${h.id}/capture`, { token: adminToken })
    const res = await call('POST', `/admin/api/v1/escrow/${h.id}/release`, { token: adminToken })
    assert.equal(res.status, 409)
    assert.equal(res.json.error.code, 'ERR_NO_PAYOUT_ACCOUNT')
  })
})

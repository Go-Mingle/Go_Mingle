/**
 * Data created on one portal reaches the other, and everything survives a
 * restart: tables and timings, menu options, interest tables, roles and users,
 * the change log, and the snapshot/restore of every contract store.
 */
import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

process.env.NODE_ENV = 'test'
process.env.DATA_FILE = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gm-int-')), 'db.json')
process.env.PORT = '4997'
process.env.PUBLIC_URL = 'http://localhost:4997'
const { app } = await import('../src/server.js')
const state = await import('../src/state.js')
const { admin } = await import('../src/contracts/registry.js')
const { flushState } = await import('../src/integration.js')

const base = 'http://localhost:4997'
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
const data = (r) => r.json?.data ?? r.json
const items = (r) => data(r)?.items ?? []

before(() => new Promise((resolve) => { server = app.listen(4997, resolve) }))
after(() => new Promise((resolve) => server.close(resolve)))

async function upload(token, plural, name, type, bytes) {
  const t = await call('POST', `/partner/api/v1/partner/restaurant/${plural}/upload-url`, { token, body: { name, contentType: type, size: bytes.length } })
  await fetch(data(t).uploadUrl, { method: 'PUT', headers: { 'Content-Type': type }, body: bytes })
  return call('POST', `/partner/api/v1/partner/restaurant/${plural}`, { token, body: { uploadRef: data(t).uploadRef } })
}

describe('state snapshots', () => {
  it('round-trips maps, sets, binary data and dates, and skips code', () => {
    const encoded = state.encode({
      m: new Map([['a', 1]]),
      s: new Set(['x']),
      b: new Uint8Array([1, 2, 3]).buffer,
      d: new Date('2026-11-09T10:00:00Z'),
      u: undefined,
    })
    const back = state.decode(JSON.parse(JSON.stringify(encoded)))
    assert.deepEqual([...back.m], [['a', 1]])
    assert.deepEqual([...back.s], ['x'])
    assert.deepEqual([...new Uint8Array(back.b)], [1, 2, 3])
    assert.equal(back.d.toISOString(), '2026-11-09T10:00:00.000Z')
    assert.equal(typeof state.encode({ f: () => 1 }), 'symbol')
  })

  it('restores records in place, keeping the stores other modules hold', () => {
    const roles = admin.stateModules.get('data/index.ts').read().mockRoles
    const snapshot = state.capture(admin)
    roles.push({ id: 'r-temp', name: 'Temp', fullAccess: false, permissions: [], usersAssigned: 0, deleted_at: null })
    state.apply(admin, snapshot)
    assert.equal(admin.stateModules.get('data/index.ts').read().mockRoles, roles)
    assert.ok(!roles.some((r) => r.id === 'r-temp'))
  })
})

describe('cross-portal data', () => {
  let adminToken
  let partner
  let restaurantId
  let tableId
  let comboId

  it('partner tables, timings and menu options reach the admin restaurant', async () => {
    adminToken = (await call('POST', '/admin/api/v1/auth/login', { body: { email: 'admin@gomingle.com', password: 'Admin@123' } })).json.accessToken
    partner = (await call('POST', '/partner/api/v1/partner/auth/login', { body: { email: 'partner@gomingle.com', password: 'Partner@123' } })).json.accessToken
    restaurantId = data(await call('GET', '/partner/api/v1/partner/session', { token: partner })).restaurant.id

    await call('PATCH', '/partner/api/v1/partner/restaurant', {
      token: partner,
      body: {
        name: 'Kolachi', cuisine: 'Pakistani', description: 'Seafront barbecue.',
        location: { areaDistrict: 'DHA', city: 'Karachi', fullAddress: 'Do Darya, Karachi', latitude: 24.78, longitude: 67.06 },
        owner: { name: 'Raees', email: 'o@kolachi.pk', phone: '+923001112233' },
        restaurant: { phone: '+922135250000', email: 'hi@kolachi.pk', website: 'kolachi.pk' },
      },
    })
    await upload(partner, 'photos', 'a.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1]))
    await upload(partner, 'documents', 'l.pdf', 'application/pdf', Buffer.from('%PDF-1.4'))
    await call('PUT', '/partner/api/v1/partner/restaurant/payout-account', { token: partner, body: { accountTitle: 'Kolachi', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' } })
    tableId = data(await call('POST', '/partner/api/v1/partner/restaurant/tables', {
      token: partner,
      body: { name: 'Sea View', availability: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [{ start: '19:00', end: '23:00' }], 6: [] } },
    })).tableId
    comboId = data(await call('POST', '/partner/api/v1/partner/restaurant/menu-options', {
      token: partner,
      body: { name: 'BBQ Platter', pricePkr: 9500, courses: [{ course: 'Mains', choose: 1, options: ['Tikka', 'Kebab'] }] },
    })).comboId
    assert.equal((await call('POST', '/partner/api/v1/partner/restaurant/submit', { token: partner })).status, 200)

    const tables = items(await call('GET', `/admin/api/v1/restaurants/${restaurantId}/tables`, { token: adminToken }))
    assert.deepEqual(tables, [{ id: tableId, name: 'Sea View', availability: [{ dayOfWeek: 5, start: '7:00 PM', end: '11:00 PM' }] }])
    const menus = items(await call('GET', `/admin/api/v1/restaurants/${restaurantId}/menu-options`, { token: adminToken }))
    assert.deepEqual(menus.map((m) => [m.id, m.name, m.pricePkr]), [[comboId, 'BBQ Platter', 9500]])
    const detail = data(await call('GET', `/admin/api/v1/restaurants/${restaurantId}`, { token: adminToken }))
    assert.match(detail.avatarUrl, /mock-cdn\/photo-\d+\.jpg$/)
    assert.equal((await fetch(detail.avatarUrl)).status, 200)
  })

  it('admin interest tables use them and show up for the partner', async () => {
    const cat = data(await call('POST', '/admin/api/v1/categories', { token: adminToken, body: { name: 'Premium', commissionRate: 12 } }))
    await call('POST', `/admin/api/v1/admin/approvals/${restaurantId}/approve`, { token: adminToken, body: { categoryId: cat.id } })
    const interest = data(await call('POST', '/admin/api/v1/interests', { token: adminToken, body: { name: 'Coffee', groupName: 'Food' } }))
    const topic = data(await call('POST', '/admin/api/v1/topics', { token: adminToken, body: { name: 'Founders', interestIds: [interest.id] } }))
    const it = data(await call('POST', `/admin/api/v1/restaurants/${restaurantId}/interest-tables`, {
      token: adminToken,
      body: {
        name: 'Founders Night', topicId: topic.id, maxGuests: 6, startDate: '2026-12-12', startTime: '19:30', durationMinutes: 120,
        restaurantTableId: tableId, menuOptionIds: [comboId], availabilityMode: 'AVAILABLE_NOW', publish: true,
      },
    }))
    assert.equal(it.assignedTable.name, 'Sea View')
    assert.equal(it.topic.name, 'Founders')
    const mine = data(await call('GET', `/partner/api/v1/partner/interest-tables/${it.id}`, { token: partner }))
    assert.equal(mine.name, 'Founders Night')
    assert.equal(mine.assignedTable, 'Sea View')
    assert.equal(mine.startTime, '7:30 PM')
    const menu = items(await call('GET', `/partner/api/v1/partner/interest-tables/${it.id}/menu-options`, { token: partner }))
    assert.deepEqual(menu.map((m) => m.name), ['BBQ Platter'])
    assert.equal((await call('DELETE', `/partner/api/v1/partner/restaurant/menu-options/${comboId}`, { token: partner })).status, 409)
  })

  it('roles reach the Users screen and new admins can sign in', async () => {
    const role = data(await call('POST', '/admin/api/v1/roles', { token: adminToken, body: { name: 'Ops', fullAccess: false, permissions: ['FINANCES'] } }))
    const active = await call('GET', '/admin/api/v1/roles/active', { token: adminToken })
    assert.ok(active.json.items.some((r) => r.id === role.id))
    const user = data(await call('POST', '/admin/api/v1/users', {
      token: adminToken,
      body: { fullName: 'Ayesha', email: 'ayesha@gomingle.com', roleId: role.id, password: 'Ops@12345', confirmPassword: 'Ops@12345' },
    }))
    assert.equal(user.role.name, 'Ops')
    const login = await call('POST', '/admin/api/v1/auth/login', { body: { email: 'ayesha@gomingle.com', password: 'Ops@12345' } })
    assert.equal(login.status, 200)
    assert.deepEqual(login.json.user.role.permissions, ['FINANCES'])
  })

  it('records admin changes in the change log', async () => {
    const log = await call('GET', '/admin/api/v1/change-log', { token: adminToken })
    const modules = new Set(log.json.map((r) => r.module))
    for (const m of ['Approvals', 'Categories', 'Interest Tables', 'Roles & Access', 'Users']) assert.ok(modules.has(m), m)
    assert.ok(log.json.every((r) => r.admin === 'admin@gomingle.com'))
  })

  it('writes every store to disk', () => {
    flushState()
    const dir = path.join(path.dirname(process.env.DATA_FILE), 'state')
    const saved = JSON.parse(fs.readFileSync(path.join(dir, 'admin.json'), 'utf8'))
    assert.ok(saved['data/index.ts'].mockRoles.some((r) => r.name === 'Ops'))
    const tenant = JSON.parse(fs.readFileSync(path.join(dir, `tenant-${restaurantId}.json`), 'utf8'))
    assert.ok(tenant['data/partnerTables.ts'].tables.some((t) => t.name === 'Sea View'))
  })
})

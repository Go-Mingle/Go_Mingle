import { after, before, describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.PORT = '4999'
const { app } = await import('../src/server.js')

let server
const base = 'http://localhost:4999'
const json = { 'Content-Type': 'application/json' }
const post = (path, body, token) =>
  fetch(base + path, {
    method: 'POST',
    headers: { ...json, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
const get = (path, token) => fetch(base + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

before(() => new Promise((resolve) => { server = app.listen(4999, resolve) }))
after(() => new Promise((resolve) => server.close(resolve)))

describe('health', () => {
  it('reports ok', async () => {
    const res = await get('/health')
    assert.equal(res.status, 200)
    assert.equal((await res.json()).status, 'ok')
  })
})

describe('admin auth', () => {
  it('rejects a wrong password', async () => {
    const res = await post('/admin/api/v1/auth/login', { email: 'admin@gomingle.com', password: 'nope' })
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error.code, 'ERR_INVALID_CREDENTIALS')
  })

  it('signs in, reads /me and refreshes', async () => {
    const res = await post('/admin/api/v1/auth/login', { email: 'Admin@GoMingle.com', password: 'Admin@123' })
    assert.equal(res.status, 200)
    const { accessToken, refreshToken } = await res.json()
    const me = await (await get('/admin/api/v1/auth/me', accessToken)).json()
    assert.equal(me.email, 'admin@gomingle.com')
    assert.equal(me.role.fullAccess, true)
    const refreshed = await post('/admin/api/v1/auth/refresh', { refreshToken })
    assert.equal(refreshed.status, 200)
    // refresh tokens rotate: the old one is spent
    assert.equal((await post('/admin/api/v1/auth/refresh', { refreshToken })).status, 401)
  })

  it('protects data routes', async () => {
    const res = await get('/admin/api/v1/restaurants')
    assert.equal(res.status, 401)
    assert.equal((await res.json()).error.code, 'ERR_TOKEN_INVALID')
  })

  it('starts a fresh install with no demo records', async () => {
    const { accessToken } = await (await post('/admin/api/v1/auth/login', { email: 'admin@gomingle.com', password: 'Admin@123' })).json()
    for (const path of ['/api/v1/restaurants', '/api/v1/minglers', '/api/v1/categories', '/api/v1/amenities', '/api/v1/interest-tables']) {
      const body = await (await get(`/admin${path}?page=1&pageSize=25`, accessToken)).json()
      const items = body.data?.items ?? body.items ?? body.data ?? []
      assert.equal(items.length, 0, path)
    }
    const roles = await (await get('/admin/api/v1/roles/active', accessToken)).json()
    assert.deepEqual(roles.items.map((r) => r.name), ['Super Admin'])
  })

  it('rejects a partner token on admin routes', async () => {
    const { accessToken } = await (await post('/partner/api/v1/partner/auth/login', { email: 'partner@gomingle.com', password: 'Partner@123' })).json()
    assert.equal((await get('/admin/api/v1/restaurants', accessToken)).status, 401)
  })

  it('locks the account after five failed attempts', async () => {
    let res
    for (let i = 0; i < 5; i++) res = await post('/admin/api/v1/auth/record-login-result', { email: 'admin@gomingle.com', succeeded: false })
    assert.equal(res.status, 423)
    const login = await post('/admin/api/v1/auth/login', { email: 'admin@gomingle.com', password: 'Admin@123' })
    assert.equal(login.status, 423)
  })
})

describe('partner auth and sign-up', () => {
  it('signs in to an empty draft restaurant', async () => {
    const res = await post('/partner/api/v1/partner/auth/login', { email: 'partner@gomingle.com', password: 'Partner@123' })
    assert.equal(res.status, 200)
    const { accessToken, user } = await res.json()
    assert.equal(user.email, 'partner@gomingle.com')
    const session = await (await get('/partner/api/v1/partner/session', accessToken)).json()
    assert.equal(session.data.route, 'PROFILE_SETUP')
  })

  it('runs sign-up end to end without moving the seeded partner', async () => {
    const email = 'owner@kolachi.pk'
    assert.equal((await post('/partner/api/v1/partner/signup/start', { email })).status, 200)
    const verify = await post('/partner/api/v1/partner/signup/verify', { email, code: '123456' })
    assert.equal(verify.status, 201)
    const verified = await verify.json()
    const token = verified.data.session.accessToken
    const done = await post('/partner/api/v1/partner/signup/complete', { password: 'Kolachi@2026' }, token)
    assert.equal(done.status, 200)
    const session = await (await get('/partner/api/v1/partner/session', token)).json()
    assert.equal(session.data.route, 'PROFILE_SETUP')
    const relog = await post('/partner/api/v1/partner/auth/login', { email, password: 'Kolachi@2026' })
    assert.equal(relog.status, 200)
    const seeded = await (await post('/partner/api/v1/partner/auth/login', { email: 'partner@gomingle.com', password: 'Partner@123' })).json()
    const seededSession = await (await get('/partner/api/v1/partner/session', seeded.accessToken)).json()
    assert.equal(seededSession.data.route, 'PROFILE_SETUP')
    assert.notEqual(seededSession.data.restaurant.id, session.data.restaurant.id)
  })

  it('rejects a wrong sign-up code', async () => {
    const email = 'wrong@code.pk'
    await post('/partner/api/v1/partner/signup/start', { email })
    const res = await post('/partner/api/v1/partner/signup/verify', { email, code: '000111' })
    assert.ok(res.status >= 400)
  })
})

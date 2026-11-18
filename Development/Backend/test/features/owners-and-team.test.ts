import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'
import { outbox } from '../../src/shared/email/mail-transport'

const A = '/admin/api/v1'
const P = '/partner/api/v1/partner'
const PASSWORD = 'Kolachi@2026'

/**
 * Who sees the team, who can change it, and how a GoMingle admin hands a
 * restaurant to new owners (GM-317, GM-318, GM-319).
 */
describe('team visibility and restaurant owners', () => {
  let s: TestServer
  let admin = ''
  let owner = ''
  let restaurantId = ''

  async function call(method: string, path: string, body?: unknown, token?: string) {
    const res = await fetch(s.base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
  const signIn = async (email: string, password = PASSWORD) => {
    const r = await call('POST', `${P}/auth/login`, { email, password })
    return { status: r.status, token: (r.json?.data?.accessToken ?? r.json?.accessToken ?? r.json?.data?.session?.accessToken) as string }
  }
  const addMember = async (fullName: string, email: string, designation = 'Manager') => {
    const r = await call('POST', `${P}/users`, { fullName, email, designation, password: PASSWORD, confirmPassword: PASSWORD }, owner)
    expect(r.status, JSON.stringify(r.json)).toBe(201)
    return r.json.data.id as string
  }
  const logins = async () => {
    const r = await call('GET', `${A}/restaurants/${restaurantId}/logins`, undefined, admin)
    if (!r.json?.data) throw new Error(`logins ${r.status} ${JSON.stringify(r.json)} ${restaurantId}`)
    return r.json.data.items as Array<Record<string, unknown>>
  }
  const loginOf = async (email: string) => (await logins()).find((l) => l.email === email) as Record<string, unknown>
  const edit = (loginId: string, body: unknown) => call('PATCH', `${A}/restaurants/${restaurantId}/logins/${loginId}`, body, admin)

  beforeAll(async () => {
    s = await startTestServer()
    admin = (await call('POST', `${A}/auth/login`, { email: 'admin@gomingle.com', password: 'Admin@123' })).json.accessToken
    // An admin creates the restaurant; its owner signs up with that email.
    const created = await call('POST', `${A}/restaurants`, { name: 'Kolachi', ownerName: 'Rahim Ahmed', ownerEmail: 'rahim@kolachi.pk' }, admin)
    expect(created.status, JSON.stringify(created.json)).toBe(201)
    restaurantId = created.json.data.id
    await call('POST', `${P}/signup/start`, { email: 'rahim@kolachi.pk' })
    const code =
      [...outbox].reverse().find((m) => m.to === 'rahim@kolachi.pk' && /\b\d{6}\b/.test(m.email.text))?.email.text.match(/\b(\d{6})\b/)?.[1] ?? ''
    const verified = await call('POST', `${P}/signup/verify`, { email: 'rahim@kolachi.pk', code })
    expect(verified.status, JSON.stringify(verified.json)).toBe(201)
    expect(verified.json.data.restaurant.id).toBe(restaurantId)
    owner = verified.json.data.session.accessToken
    await call('POST', `${P}/signup/complete`, { password: 'Partner@123', fullName: 'Rahim Ahmed' }, owner)
  })
  afterAll(async () => {
    await s?.close()
  })

  describe('Partner Portal: everyone sees the team, only owners change it', () => {
    let memberId = ''
    let member = ''

    it('shows a team member the active colleagues: name, role, designation and email only', async () => {
      memberId = await addMember('Sara Khan', 'sara@kolachi.pk', 'Floor Manager')
      const suspended = await addMember('Bilal Ahmed', 'bilal@kolachi.pk')
      await call('PATCH', `${P}/users/${suspended}`, { status: 'SUSPENDED' }, owner)
      member = (await signIn('sara@kolachi.pk')).token

      const seen = await call('GET', `${P}/users`, undefined, member)
      expect(seen.status).toBe(200)
      expect(seen.json.data.canManage).toBe(false)
      const rows = seen.json.data.items as Array<Record<string, unknown>>
      expect(rows.map((r) => r.email)).toEqual(expect.arrayContaining(['rahim@kolachi.pk', 'sara@kolachi.pk']))
      expect(rows.map((r) => r.email)).not.toContain('bilal@kolachi.pk')
      expect(rows.find((r) => r.email === 'rahim@kolachi.pk')).toMatchObject({ role: 'OWNER', isPrimary: true })
      expect(rows.find((r) => r.email === 'sara@kolachi.pk')).toMatchObject({ role: 'MEMBER', fullName: 'Sara Khan', designation: 'Floor Manager' })
      // Nothing about sign-in or status reaches a team member.
      for (const r of rows) expect(Object.keys(r).sort()).toEqual(['designation', 'email', 'fullName', 'id', 'isPrimary', 'role'])
    })

    it('gives the owner the full grid, suspended people included', async () => {
      const seen = await call('GET', `${P}/users`, undefined, owner)
      expect(seen.json.data.canManage).toBe(true)
      const rows = seen.json.data.items as Array<Record<string, unknown>>
      expect(rows.find((r) => r.email === 'bilal@kolachi.pk')).toMatchObject({ status: 'SUSPENDED', role: 'MEMBER', canDelete: true })
    })

    it('refuses every change from a team member (GM-317)', async () => {
      const ownerId = (await loginOf('rahim@kolachi.pk')).id as string
      const attempts = [
        call('POST', `${P}/users`, { fullName: 'X', email: 'x@kolachi.pk', password: PASSWORD, confirmPassword: PASSWORD }, member),
        call('PATCH', `${P}/users/${ownerId}`, { fullName: 'Taken over' }, member),
        call('POST', `${P}/users/${ownerId}/set-password`, { password: 'Hacked@2026', confirmPassword: 'Hacked@2026' }, member),
        call('DELETE', `${P}/users/${memberId}`, undefined, member),
      ]
      for (const r of await Promise.all(attempts)) {
        expect(r.status).toBe(403)
        expect(r.json.error.code).toBe('ERR_OWNER_ONLY')
      }
      // The owner's password still works.
      expect((await signIn('rahim@kolachi.pk', 'Partner@123')).status).toBe(200)
    })
  })

  describe('Admin Panel: editing access and owners (GM-319)', () => {
    it('lists designation with each login', async () => {
      expect(await loginOf('sara@kolachi.pk')).toMatchObject({ isOwner: false, designation: 'Floor Manager', status: 'ACTIVE' })
    })

    it('makes a team member an owner, who can then manage the team', async () => {
      const sara = (await loginOf('sara@kolachi.pk')).id as string
      const r = await edit(sara, { isOwner: true })
      expect(r.status, JSON.stringify(r.json)).toBe(200)
      expect(r.json.data.login).toMatchObject({ isOwner: true, designation: 'Floor Manager' })
      const token = (await signIn('sara@kolachi.pk')).token
      expect((await call('GET', `${P}/users`, undefined, token)).json.data.canManage).toBe(true)
      expect((await call('GET', `${P}/session`, undefined, token)).json.data.partnerUser.isPrimary).toBe(true)
    })

    it('lets two owners share the restaurant, but not change each other from the portal', async () => {
      const sara = (await signIn('sara@kolachi.pk')).token
      const ownerId = (await loginOf('rahim@kolachi.pk')).id as string
      const reset = await call('POST', `${P}/users/${ownerId}/set-password`, { password: 'Taken@2026', confirmPassword: 'Taken@2026' }, sara)
      expect(reset.status).toBe(403)
      expect((await call('PATCH', `${P}/users/${ownerId}`, { status: 'SUSPENDED' }, sara)).status).toBe(403)
      expect((await call('DELETE', `${P}/users/${ownerId}`, undefined, sara)).status).toBe(403)
    })

    it('hands the restaurant over when the original owner is locked out', async () => {
      const original = (await loginOf('rahim@kolachi.pk')).id as string
      const r = await edit(original, { status: 'SUSPENDED' })
      expect(r.status, JSON.stringify(r.json)).toBe(200)
      expect((await signIn('rahim@kolachi.pk', 'Partner@123')).status).not.toBe(200)
      // And back again.
      expect((await edit(original, { status: 'ACTIVE' })).status).toBe(200)
      expect((await signIn('rahim@kolachi.pk', 'Partner@123')).status).toBe(200)
    })

    it('never leaves a restaurant without an active owner', async () => {
      const sara = (await loginOf('sara@kolachi.pk')).id as string
      const original = (await loginOf('rahim@kolachi.pk')).id as string
      expect((await edit(sara, { isOwner: false })).status).toBe(200)
      for (const body of [{ isOwner: false }, { status: 'SUSPENDED' }]) {
        const r = await edit(original, body)
        expect(r.status).toBe(409)
        expect(r.json.error.code).toBe('ERR_LAST_OWNER')
      }
      const removed = await call('DELETE', `${A}/restaurants/${restaurantId}/logins/${original}`, undefined, admin)
      expect(removed.status).toBe(409)
      // Two admins demoting the two owners at once: one of them must lose.
      await edit(sara, { isOwner: true })
      const both = await Promise.all([edit(sara, { isOwner: false }), edit(original, { isOwner: false })])
      expect(both.map((r) => r.status).sort()).toEqual([200, 409])
      expect((await logins()).filter((l) => l.isOwner && l.status === 'ACTIVE')).toHaveLength(1)
      // Put Sara back as an owner for what follows.
      await edit(sara, { isOwner: true })
      await edit(original, { isOwner: true })
    })

    it('keeps the designation in step with the role unless one was set', async () => {
      const bilal = (await loginOf('bilal@kolachi.pk')).id as string
      await edit(bilal, { designation: '' })
      expect((await edit(bilal, { isOwner: true })).json.data.login.designation).toBe('Owner')
      expect((await edit(bilal, { isOwner: false })).json.data.login.designation).toBeNull()
    })

    it('changes a login email: valid, unused, and Google is unlinked', async () => {
      const bilal = (await loginOf('bilal@kolachi.pk')).id as string
      expect((await edit(bilal, { email: 'not-an-email' })).status).toBe(422)
      expect((await edit(bilal, { email: 'admin@gomingle.com' })).json.error.code).toBe('ERR_EMAIL_IS_ADMIN')
      expect((await edit(bilal, { email: 'sara@kolachi.pk' })).json.error.code).toBe('ERR_EMAIL_IN_USE')
      const r = await edit(bilal, { email: 'Bilal.Ahmed@Kolachi.pk', fullName: 'Bilal Ahmed Khan' })
      expect(r.status, JSON.stringify(r.json)).toBe(200)
      expect(r.json.data).toMatchObject({ emailed: true, login: { email: 'bilal.ahmed@kolachi.pk', fullName: 'Bilal Ahmed Khan', hasGoogle: false } })
    })

    it('refuses unknown fields, bad values and logins of another restaurant', async () => {
      const bilal = (await loginOf('bilal.ahmed@kolachi.pk')).id as string
      expect((await edit(bilal, { password: 'x' })).status).toBe(422)
      expect((await edit(bilal, { isOwner: 'yes' })).status).toBe(422)
      expect((await edit(bilal, { status: 'DELETED' })).status).toBe(422)
      expect((await edit(bilal, { fullName: 'B' })).status).toBe(422)
      expect((await edit('pu-nope', { fullName: 'Someone' })).json.error.code).toBe('ERR_LOGIN_NOT_FOUND')
    })

    it('removes access, keeps the person on record, and logs every change in words', async () => {
      const bilal = (await loginOf('bilal.ahmed@kolachi.pk')).id as string
      const r = await call('DELETE', `${A}/restaurants/${restaurantId}/logins/${bilal}`, undefined, admin)
      expect(r.status).toBe(200)
      expect((await logins()).map((l) => l.email)).not.toContain('bilal.ahmed@kolachi.pk')
      expect((await edit(bilal, { fullName: 'Back' })).status).toBe(404)
      const log = (await call('GET', `${A}/change-log`, undefined, admin)).json as Array<Record<string, string>>
      const texts = log.map((e) => e.newVal)
      expect(texts).toContain('Removed portal access: bilal.ahmed@kolachi.pk')
      expect(texts.some((t) => /^Changed portal access for sara@kolachi\.pk: made owner/.test(t))).toBe(true)
      expect(log.find((e) => e.newVal === 'Removed portal access: bilal.ahmed@kolachi.pk')).toMatchObject({ module: 'Restaurants', action: 'update' })
    })

    it('can give a new email owner access straight away', async () => {
      const r = await call('POST', `${A}/restaurants/${restaurantId}/logins`, { fullName: 'Ayesha Malik', email: 'ayesha@kolachi.pk', isOwner: true }, admin)
      expect(r.status, JSON.stringify(r.json)).toBe(201)
      expect(r.json.data.login).toMatchObject({ isOwner: true, designation: 'Owner', pending: true })
    })
  })
})

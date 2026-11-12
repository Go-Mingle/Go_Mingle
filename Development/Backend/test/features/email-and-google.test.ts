import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'
import { outbox } from '../../src/shared/email/mail-transport'
import { setGoogleKeysForTests } from '../../src/auth/google'
import { MailService } from '../../src/shared/email/mail.service'

const A = '/admin/api/v1'
const P = '/partner/api/v1/partner'
const CLIENT_ID = 'test-client.apps.googleusercontent.com'

describe('email templates, email delivery and Google sign-in', () => {
  let s: TestServer
  let adminToken = ''
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })

  async function call(method: string, path: string, body?: unknown, token?: string) {
    const res = await fetch(s.base + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }

  const googleToken = (claims: Record<string, unknown>, opts: { aud?: string; kid?: string } = {}) =>
    jwt.sign({ email_verified: true, ...claims }, privateKey, {
      algorithm: 'RS256',
      keyid: opts.kid ?? 'k1',
      audience: opts.aud ?? CLIENT_ID,
      issuer: 'https://accounts.google.com',
      expiresIn: 300,
    })

  beforeAll(async () => {
    s = await startTestServer()
    const login = await call('POST', `${A}/auth/login`, { email: 'admin@gomingle.com', password: 'Admin@123' })
    adminToken = login.json.accessToken
    setGoogleKeysForTests({ k1: publicKey })
  })
  afterAll(async () => {
    setGoogleKeysForTests(null)
    delete process.env.GOOGLE_CLIENT_ID
    await s?.close()
  })
  beforeEach(() => {
    outbox.length = 0
  })

  it('lists every template with its placeholders', async () => {
    const r = await call('GET', `${A}/email-templates`, undefined, adminToken)
    expect(r.status).toBe(200)
    const keys = r.json.data.map((t: { key: string }) => t.key)
    expect(keys).toContain('partner_signup_code')
    expect(keys).toContain('payout_released')
    const signup = r.json.data.find((t: { key: string }) => t.key === 'partner_signup_code')
    expect(signup).toMatchObject({ required: true, enabled: true, isDefault: true, hasButton: false })
    expect(signup.placeholders.map((p: { name: string }) => p.name)).toEqual(['code', 'minutes'])
    expect((await call('GET', `${A}/email-templates`)).status).toBe(401)
    const keys2 = await call('GET', `${A}/roles/permission-keys`, undefined, adminToken)
    const configure = keys2.json.data.sections[0].permissions.map((x: { key: string }) => x.key)
    expect(configure).toContain('EMAIL_TEMPLATES')
  })

  it('edits, previews, tests and restores a template', async () => {
    const bad = await call('PATCH', `${A}/email-templates/restaurant_approved`, { body: 'Hi {{name}}, {{nope}}' }, adminToken)
    expect(bad.status).toBe(422)
    expect(bad.json.error.details.fields.body).toContain('{{nope}}')

    const ok = await call('PATCH', `${A}/email-templates/restaurant_approved`, { subject: 'Welcome aboard, {{restaurantName}}!', enabled: false }, adminToken)
    expect(ok.status).toBe(200)
    expect(ok.json.data).toMatchObject({ subject: 'Welcome aboard, {{restaurantName}}!', enabled: false, isDefault: false, updatedBy: 'Hira Mansoor' })

    const preview = await call('POST', `${A}/email-templates/restaurant_approved/preview`, { heading: 'Hello {{name}}' }, adminToken)
    expect(preview.json.data.subject).toBe('Welcome aboard, Kolachi!')
    expect(preview.json.data.html).toContain('Hello Raees Khan')
    expect(preview.json.data.html).toContain('Go to your dashboard')

    const test = await call('POST', `${A}/email-templates/restaurant_approved/test`, {}, adminToken)
    expect(test.json.data.to).toBe('admin@gomingle.com')
    expect(outbox.at(-1)?.email.subject).toBe('[Test] Welcome aboard, Kolachi!')

    // Switched off: the event sends nothing and the log says so.
    const mail = s.app.get(MailService)
    expect(await mail.toRestaurantOwner('rest1', 'restaurant_approved', { restaurantName: 'Kolachi', category: 'Cafe' })).toBeNull()
    const log = await call('GET', `${A}/email-templates/log`, undefined, adminToken)
    expect(log.json.data[0]).toMatchObject({ templateKey: 'restaurant_approved', status: 'SKIPPED', to: 'partner@gomingle.com' })

    const reset = await call('POST', `${A}/email-templates/restaurant_approved/reset`, {}, adminToken)
    expect(reset.json.data).toMatchObject({ isDefault: true, enabled: false })

    const cl = await call('GET', `${A}/change-log`, undefined, adminToken)
    const rows = (Array.isArray(cl.json) ? cl.json : cl.json.data) as { module: string; newVal: string }[]
    expect(rows.some((r) => r.module === 'Email Templates')).toBe(true)
  })

  it('keeps codes in code emails and required emails on', async () => {
    const r = await call('PATCH', `${A}/email-templates/partner_signup_code`, { body: 'Welcome!', enabled: false }, adminToken)
    expect(r.status).toBe(422)
    const off = await call('PATCH', `${A}/email-templates/partner_signup_code`, { enabled: false }, adminToken)
    expect(off.json.data.enabled).toBe(true)
  })

  it('emails sign-up and reset codes, and team welcomes', async () => {
    await call('POST', `${P}/signup/start`, { email: 'new.owner@kolachi.pk' })
    const signup = outbox.find((m) => m.to === 'new.owner@kolachi.pk')
    expect(signup?.email.subject).toMatch(/^Your GoMingle sign-up code: \d{6}$/)
    const code = /(\d{6})$/.exec(signup!.email.subject)![1]
    expect(signup!.email.html).toContain(code)
    const verify = await call('POST', `${P}/signup/verify`, { email: 'new.owner@kolachi.pk', code })
    expect(verify.status).toBe(201)

    await call('POST', `${P}/auth/forgot-password`, { email: 'partner@gomingle.com' })
    expect(outbox.at(-1)).toMatchObject({ to: 'partner@gomingle.com', category: 'partner_password_reset' })
    expect(outbox.at(-1)!.email.text).toContain('Hi Hira Mansoor')

    await call('POST', `${A}/auth/forgot-password/request-code`, { email: 'admin@gomingle.com' })
    expect(outbox.at(-1)).toMatchObject({ to: 'admin@gomingle.com', category: 'admin_password_reset' })

    const partner = await call('POST', `${P}/auth/login`, { email: 'partner@gomingle.com', password: 'Partner@123' })
    await call(
      'POST',
      `${P}/users`,
      { fullName: 'Sara Aziz', email: 'sara@kolachi.pk', password: 'Sara@12345', confirmPassword: 'Sara@12345' },
      partner.json.accessToken,
    )
    expect(outbox.at(-1)).toMatchObject({ to: 'sara@kolachi.pk', category: 'partner_team_welcome' })
    expect(outbox.at(-1)!.email.text).toContain('Hira Mansoor added you')
  })

  it('stops accepting the demo code once email delivery is set up', async () => {
    process.env.MAILTRAP_API_TOKEN = 'configured'
    try {
      const r = await call('POST', `${P}/auth/confirm-forgot-password`, { email: 'partner@gomingle.com', code: '123456', newPassword: 'Partner@1234' })
      expect(r.status).toBe(400)
    } finally {
      delete process.env.MAILTRAP_API_TOKEN
    }
  })

  it('signs partners in and up with Google', async () => {
    const off = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g1', email: 'x@y.pk' }) })
    expect(off.status).toBe(503)
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID

    const created = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g-new', email: 'Ayesha@Cafe.pk', name: 'Ayesha Malik' }) })
    expect(created.status).toBe(200)
    expect(created.json).toMatchObject({ isNew: true, route: 'PROFILE_SETUP', user: { email: 'ayesha@cafe.pk', fullName: 'Ayesha Malik' } })
    expect(created.json.accessToken).toBeTruthy()
    const session = await call('GET', `${P}/session`, undefined, created.json.accessToken)
    expect(session.json.data.restaurant.status).toBe('DRAFT')

    const again = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g-new', email: 'ayesha@cafe.pk' }) })
    expect(again.json).toMatchObject({ isNew: false, user: { email: 'ayesha@cafe.pk' } })

    const existing = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g-owner', email: 'partner@gomingle.com' }) })
    expect(existing.json).toMatchObject({ isNew: false, user: { id: 'pu-owner' } })

    const otherGoogleAccount = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g-other', email: 'partner@gomingle.com' }) })
    expect(otherGoogleAccount.status).toBe(401)

    const wrongAudience = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g2', email: 'a@b.pk' }, { aud: 'someone-else' }) })
    expect(wrongAudience.status).toBe(401)
    const unverified = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g3', email: 'c@d.pk', email_verified: false }) })
    expect(unverified.status).toBe(401)
    const garbage = await call('POST', `${P}/auth/google`, { credential: 'not-a-token' })
    expect(garbage.status).toBe(401)
    const admin = await call('POST', `${P}/auth/google`, { credential: googleToken({ sub: 'g4', email: 'admin@gomingle.com' }) })
    expect(admin.status).toBe(409)
  })
})

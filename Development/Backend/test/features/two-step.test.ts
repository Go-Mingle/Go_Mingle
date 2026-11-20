import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'
import { base32Decode, base32Encode, hotp, totp, totpStep, verifyTotp } from '../../src/auth/totp'

const A = '/admin/api/v1'

describe('TOTP (RFC 6238)', () => {
  // RFC 6238 appendix B / RFC 4226 appendix D: secret "12345678901234567890".
  const secret = base32Encode(Buffer.from('12345678901234567890'))
  it('matches the published test vectors', () => {
    expect(hotp(secret, 0)).toBe('755224')
    expect(hotp(secret, 1)).toBe('287082')
    expect(totp(secret, 59_000)).toBe('287082')
    expect(totp(secret, 1_111_111_109_000)).toBe('081804')
  })
  it('round-trips base32', () => {
    expect(base32Decode(secret).toString()).toBe('12345678901234567890')
  })
  it('accepts one step of drift, never a used step, and only six digits', () => {
    const now = 1_700_000_000_000
    const step = totpStep(now)
    expect(verifyTotp(secret, hotp(secret, step - 1), now)).toBe(step - 1)
    expect(verifyTotp(secret, hotp(secret, step - 2), now)).toBeNull()
    expect(verifyTotp(secret, hotp(secret, step), now, step)).toBeNull()
    expect(verifyTotp(secret, 'abcdef', now)).toBeNull()
  })
})

/** Two-step sign-in, sign-in sessions and the "require it for everyone" rule (GM-346). */
describe('admin two-step sign-in and sessions', () => {
  let s: TestServer
  let roleId = ''

  async function call(method: string, url: string, body?: unknown, token?: string, ua = 'vitest') {
    const res = await fetch(s.base + url, {
      method,
      headers: { 'Content-Type': 'application/json', 'User-Agent': ua, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
  const must = async (method: string, url: string, body: unknown, token?: string) => {
    const r = await call(method, url, body, token)
    expect(r.status, `${method} ${url} ${JSON.stringify(r.json)}`).toBeLessThan(300)
    return r.json?.data ?? r.json
  }
  const login = (email: string, password: string, ua?: string) => call('POST', `${A}/auth/login`, { email, password }, undefined, ua)

  let superToken = ''
  beforeAll(async () => {
    s = await startTestServer()
    superToken = (await login('admin@gomingle.com', 'Admin@123')).json.accessToken
    // A role without full access: only super admins may change the rule.
    const role = await must('POST', `${A}/roles`, { name: 'Restaurant desk', fullAccess: false, permissions: ['MANAGE_RESTAURANTS', 'RESTAURANTS'] }, superToken)
    roleId = role.id
  })
  afterAll(async () => {
    await s?.close()
  })

  async function newAdmin(tag: string) {
    const email = `two.step.${tag}@gomingle.pk`
    const u = await must('POST', `${A}/users`, { fullName: `Two Step ${tag}`, email, roleId, password: 'TwoStep!2026', confirmPassword: 'TwoStep!2026' }, superToken)
    return { id: u.id as string, email, password: 'TwoStep!2026' }
  }

  async function turnOn(token: string) {
    const setup = await must('POST', `${A}/security/two-step/setup`, {}, token)
    expect(setup.otpauthUrl).toMatch(/^otpauth:\/\/totp\/GoMingle%20Admin%3A/)
    const bad = await call('POST', `${A}/security/two-step/enable`, { code: '000000' }, token)
    expect(bad.status).toBe(400)
    const { backupCodes } = await must('POST', `${A}/security/two-step/enable`, { code: totp(setup.secret) }, token)
    expect(backupCodes).toHaveLength(10)
    return { secret: setup.secret as string, backupCodes: backupCodes as string[] }
  }

  it('asks for a code after the password once two-step is on, and each code works once', async () => {
    const a = await newAdmin('a')
    const first = await login(a.email, a.password)
    expect(first.json.accessToken).toBeTruthy()
    expect(first.json.user.twoStepEnabled).toBe(false)
    const { secret, backupCodes } = await turnOn(first.json.accessToken)

    const step1 = await login(a.email, a.password)
    expect(step1.json).toMatchObject({ mfaRequired: true })
    expect(step1.json.accessToken).toBeUndefined()

    const wrong = await call('POST', `${A}/auth/login/verify`, { mfaToken: step1.json.mfaToken, code: '123456' })
    expect(wrong.status).toBe(401)
    expect(wrong.json.error?.code ?? wrong.json.code).toBe('ERR_INVALID_CODE')

    // The code that turned it on can't be used again (same 30-second step).
    const replay = await call('POST', `${A}/auth/login/verify`, { mfaToken: step1.json.mfaToken, code: totp(secret) })
    expect(replay.status).toBe(401)

    // A backup code works, once.
    const viaBackup = await call('POST', `${A}/auth/login/verify`, { mfaToken: step1.json.mfaToken, code: backupCodes[0].toLowerCase() })
    expect(viaBackup.status).toBe(200)
    expect(viaBackup.json.accessToken).toBeTruthy()
    const again = await call('POST', `${A}/auth/login/verify`, { mfaToken: step1.json.mfaToken, code: backupCodes[0] })
    expect(again.status).toBe(401)
    const overview = await must('GET', `${A}/security`, undefined, viaBackup.json.accessToken)
    expect(overview.twoStep).toMatchObject({ enabled: true, backupCodesLeft: 9 })

    // A forged step token is refused.
    const forged = await call('POST', `${A}/auth/login/verify`, { mfaToken: 'nope', code: backupCodes[1] })
    expect(forged.status).toBe(401)
  })

  it('lists sign-ins and signs one out at once, refresh included', async () => {
    const b = await newAdmin('b')
    const laptop = (await login(b.email, b.password, 'Mozilla/5.0 (Macintosh) Chrome/131')).json
    const phone = (await login(b.email, b.password, 'Mozilla/5.0 (iPhone) Safari/18')).json
    const list = await must('GET', `${A}/security/sessions`, undefined, laptop.accessToken)
    expect(list.items).toHaveLength(2)
    expect(list.items.filter((x: { current: boolean }) => x.current)).toHaveLength(1)
    const phoneSession = list.items.find((x: { userAgent: string }) => x.userAgent.includes('iPhone'))

    await must('DELETE', `${A}/security/sessions/${phoneSession.id}`, undefined, laptop.accessToken)
    const blocked = await call('GET', `${A}/auth/me`, undefined, phone.accessToken)
    expect(blocked.status).toBe(401)
    expect(blocked.json.error?.code ?? blocked.json.code).toBe('ERR_SESSION_REVOKED')
    const refresh = await call('POST', `${A}/auth/refresh`, { refreshToken: phone.refreshToken })
    expect(refresh.status).toBe(401)
    // The laptop is untouched, and its refresh keeps the same session.
    const renewed = await must('POST', `${A}/auth/refresh`, { refreshToken: laptop.refreshToken })
    expect((await call('GET', `${A}/auth/me`, undefined, renewed.accessToken)).status).toBe(200)

    // Logging out signs out this device only.
    const tablet = (await login(b.email, b.password, 'tablet')).json
    await call('POST', `${A}/auth/logout`, undefined, tablet.accessToken)
    expect((await call('GET', `${A}/auth/me`, undefined, tablet.accessToken)).status).toBe(401)
    expect((await call('GET', `${A}/auth/me`, undefined, renewed.accessToken)).status).toBe(200)

    // Sign out everywhere else.
    const other = (await login(b.email, b.password, 'other')).json
    const out = await must('POST', `${A}/security/sessions/sign-out-others`, {}, renewed.accessToken)
    expect(out.signedOut).toBe(1)
    expect((await call('GET', `${A}/auth/me`, undefined, other.accessToken)).status).toBe(401)
  })

  it('lets a super admin require two-step sign-in for everyone, and reset it for one admin', async () => {
    const c = await newAdmin('c')
    const cToken = (await login(c.email, c.password)).json.accessToken

    // The author must have it on first, so the switch can't lock them out.
    const early = await call('PUT', `${A}/security/policy`, { requireTwoStep: true }, superToken)
    expect(early.status).toBe(409)
    const notSuper = await call('PUT', `${A}/security/policy`, { requireTwoStep: true }, cToken)
    expect(notSuper.status).toBe(403)

    await turnOn(superToken)
    expect((await must('PUT', `${A}/security/policy`, { requireTwoStep: true }, superToken)).requireTwoStep).toBe(true)
    try {
      // c hasn't set it up: the panel is closed except sign-in and Security.
      const closed = await call('GET', `${A}/restaurants`, undefined, cToken)
      expect(closed.status).toBe(403)
      expect(closed.json.error?.code ?? closed.json.code).toBe('ERR_TWO_STEP_REQUIRED')
      expect((await call('GET', `${A}/auth/me`, undefined, cToken)).status).toBe(200)
      expect((await login(c.email, c.password)).json.twoStepSetupRequired).toBe(true)
      const disable = await call('POST', `${A}/security/two-step/disable`, { password: 'Admin@123' }, superToken)
      expect(disable.status).toBe(409)

      await turnOn(cToken)
      expect((await call('GET', `${A}/restaurants`, undefined, cToken)).status).toBe(200)

      // c lost their phone: the super admin turns it off for them and signs them out.
      const users = await must('GET', `${A}/users?pageSize=50`, undefined, superToken)
      expect(users.items.find((u: { id: string }) => u.id === c.id).twoStepEnabled).toBe(true)
      await must('POST', `${A}/users/${c.id}/reset-two-step`, {}, superToken)
      expect((await call('GET', `${A}/auth/me`, undefined, cToken)).status).toBe(401)
      const back = await login(c.email, c.password)
      expect(back.json.mfaRequired).toBeUndefined()
      expect(back.json.twoStepSetupRequired).toBe(true)

      const log = (await must('GET', `${A}/change-log`, undefined, superToken)) as { newVal: string }[]
      expect(log.some((l) => l.newVal === 'Two-step sign-in is now required for every admin')).toBe(true)
      expect(log.some((l) => l.newVal?.startsWith('Turned off two-step sign-in'))).toBe(true)
    } finally {
      await must('PUT', `${A}/security/policy`, { requireTwoStep: false }, superToken)
    }
  })
})

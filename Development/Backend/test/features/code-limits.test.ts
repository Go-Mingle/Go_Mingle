import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'
import { outbox } from '../../src/shared/email/mail-transport'
import { MAX_CODE_ATTEMPTS, MAX_CODES_PER_WINDOW } from '../../src/auth/codes.service'

const P = '/partner/api/v1/partner'

/** One-time codes can't be guessed by brute force, and an inbox can't be flooded with them. */
describe('one-time code limits', () => {
  let s: TestServer

  async function call(path: string, body: unknown) {
    const res = await fetch(s.base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
  const lastCodeFor = (email: string) => {
    const mail = [...outbox].reverse().find((m) => m.to === email)
    return mail?.email.text.match(/\b(\d{6})\b/)?.[1] ?? ''
  }

  beforeAll(async () => {
    s = await startTestServer()
  })
  afterAll(async () => {
    await s?.close()
  })

  it('stops accepting a code after a few wrong guesses', async () => {
    const email = 'guess@kolachi.pk'
    expect((await call(`${P}/signup/start`, { email })).status).toBe(200)
    const code = lastCodeFor(email)
    expect(code).toMatch(/^\d{6}$/)
    const wrong = code === '000001' ? '000002' : '000001'
    for (let i = 0; i < MAX_CODE_ATTEMPTS; i++) expect((await call(`${P}/signup/verify`, { email, code: wrong })).status).toBe(422)
    // Even the right code no longer works: a new one has to be requested.
    expect((await call(`${P}/signup/verify`, { email, code })).status).toBe(422)
    expect((await call(`${P}/signup/resend`, { email })).status).toBe(200)
    expect((await call(`${P}/signup/verify`, { email, code: lastCodeFor(email) })).status).toBe(201)
  })

  it('refuses to send more codes to one address for a while', async () => {
    const email = 'flood@kolachi.pk'
    for (let i = 0; i < MAX_CODES_PER_WINDOW; i++) expect((await call(`${P}/signup/resend`, { email })).status).toBe(200)
    const refused = await call(`${P}/signup/resend`, { email })
    expect(refused.status).toBe(429)
    expect(refused.json.error.code).toBe('ERR_TOO_MANY_REQUESTS')
    // Another address is unaffected.
    expect((await call(`${P}/signup/resend`, { email: 'other@kolachi.pk' })).status).toBe(200)
  })
})

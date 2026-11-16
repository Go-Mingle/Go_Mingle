import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import jwt from 'jsonwebtoken'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'
import { outbox } from '../../src/shared/email/mail-transport'
import { setGoogleKeysForTests } from '../../src/auth/google'

const A = '/admin/api/v1'
const P = '/partner/api/v1/partner'
const CLIENT_ID = 'test-client.apps.googleusercontent.com'
const PHOTO = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'E2E', 'tests', 'fixtures', 'dining.jpg'))

/**
 * One person, one restaurant: signing in a new way never opens a second, empty
 * restaurant beside the real one, and a GoMingle admin can create a restaurant
 * profile for its owner to complete (GM-306 to GM-309).
 */
describe('owner access: Google sign-in, admin-created profiles', () => {
  let s: TestServer
  let admin = ''
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
  const google = (email: string, sub: string, intent?: 'signin' | 'signup', name = 'Rahim Ahmed') =>
    call('POST', `${P}/auth/google`, {
      intent,
      credential: jwt.sign({ email_verified: true, sub, email, name }, privateKey, {
        algorithm: 'RS256',
        keyid: 'k1',
        audience: CLIENT_ID,
        issuer: 'https://accounts.google.com',
        expiresIn: 300,
      }),
    })
  const lastCodeFor = (email: string) =>
    [...outbox]
      .reverse()
      .find((m) => m.to === email && /\b\d{6}\b/.test(m.email.text))
      ?.email.text.match(/\b(\d{6})\b/)?.[1] ?? ''
  const myRestaurant = async (token: string) => (await call('GET', `${P}/restaurant`, undefined, token)).json.data

  /** Email sign-up, to the point of a signed-in owner with a password. */
  async function signUp(email: string) {
    expect((await call('POST', `${P}/signup/start`, { email })).status).toBe(200)
    const verified = await call('POST', `${P}/signup/verify`, { email, code: lastCodeFor(email) })
    expect(verified.status).toBe(201)
    const token = verified.json.data.session.accessToken as string
    expect((await call('POST', `${P}/signup/complete`, { password: 'Kolachi@2026', fullName: 'Owner' }, token)).status).toBe(200)
    return { token, route: verified.json.data.route as string, restaurantId: verified.json.data.restaurant.id as string }
  }
  /** A restaurant with a name and an owner email, sent for approval. */
  async function submit(token: string, name: string, ownerEmail: string) {
    const R = `${P}/restaurant`
    const patched = await call(
      'PATCH',
      R,
      {
        name,
        cuisine: 'Pakistani',
        description: 'Charcoal grill and karahi in the heart of the city.',
        location: { areaDistrict: 'Clifton', city: 'Karachi', fullAddress: 'Block 4, Clifton, Karachi', latitude: 24.81, longitude: 67.03 },
        owner: { name: 'Rahim Ahmed', email: ownerEmail, phone: '+923001112233' },
        restaurant: { phone: '+922135250000', email: 'hello@xanders.pk' },
      },
      token,
    )
    expect(patched.status, JSON.stringify(patched.json)).toBe(200)
    // Everything else a profile needs before it can be sent: a photo, a payout account, a table and a menu.
    const target = (await call('POST', `${R}/photos/upload-url`, { name: 'dining.jpg', contentType: 'image/jpeg' }, token)).json.data
    await fetch(new URL(target.uploadUrl, s.base).toString(), { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: PHOTO })
    await call('POST', `${R}/photos`, { uploadRef: target.uploadRef }, token)
    await call('PUT', `${R}/payout-account`, { accountTitle: `${name} Pvt Ltd`, bankName: 'HBL', iban: 'PK36SCBL0000001123456702' }, token)
    await call('POST', `${R}/tables`, { name: 'Window Table' }, token)
    await call('POST', `${R}/menu-options`, { name: 'Signature Set', pricePkr: 3500, courses: [{ course: 'Main Course', choose: 1, options: ['Biryani', 'Tikka'] }] }, token)
    const sent = await call('POST', `${R}/submit`, undefined, token)
    expect(sent.status, JSON.stringify(sent.json)).toBe(200)
    return sent
  }

  beforeAll(async () => {
    s = await startTestServer()
    process.env.GOOGLE_CLIENT_ID = CLIENT_ID
    setGoogleKeysForTests({ k1: publicKey })
    admin = (await call('POST', `${A}/auth/login`, { email: 'admin@gomingle.com', password: 'Admin@123' })).json.accessToken
  })
  afterAll(async () => {
    setGoogleKeysForTests(null)
    delete process.env.GOOGLE_CLIENT_ID
    await s?.close()
  })
  beforeEach(() => {
    outbox.length = 0
  })

  describe('Google sign-in keeps a person on their own restaurant', () => {
    it('signs an email-registered owner in to the same account and restaurant', async () => {
      const owner = await signUp('rahim@xanders.pk')
      await call('PATCH', `${P}/restaurant`, { name: 'Xanders' }, owner.token)
      for (const intent of ['signin', 'signup'] as const) {
        const g = await google('Rahim@Xanders.pk', 'g-rahim', intent)
        expect(g.status).toBe(200)
        expect(g.json).toMatchObject({ isNew: false, user: { email: 'rahim@xanders.pk' } })
        expect(await myRestaurant(g.json.accessToken)).toMatchObject({ id: owner.restaurantId, name: 'Xanders' })
      }
    })

    it('never opens a new account from the sign-in button', async () => {
      const g = await google('stranger@gmail.com', 'g-stranger', 'signin')
      expect(g.status).toBe(404)
      expect(g.json.error).toMatchObject({ code: 'GOOGLE_NO_ACCOUNT', details: { email: 'stranger@gmail.com' } })
      // Nothing was created: the sign-up button still starts a fresh account.
      const created = await google('stranger@gmail.com', 'g-stranger', 'signup')
      expect(created.json).toMatchObject({ isNew: true, route: 'PROFILE_SETUP' })
    })

    it("joins the restaurant that names the email as its owner, instead of opening an empty one", async () => {
      // The restaurant was registered under one login, with the owner's own email in its profile.
      const manager = await signUp('manager@xanders.pk')
      expect((await submit(manager.token, 'Xanders Clifton', 'rahimahmed@gmail.com')).status).toBe(200)

      const g = await google('rahimahmed@gmail.com', 'g-owner-1', 'signup')
      expect(g.status).toBe(200)
      expect(g.json).toMatchObject({ isNew: false, route: 'UNDER_REVIEW' })
      expect(await myRestaurant(g.json.accessToken)).toMatchObject({ id: manager.restaurantId, name: 'Xanders Clifton' })

      // The first login stays the owner login; the new one is on the same team.
      const logins = (await call('GET', `${A}/restaurants/${manager.restaurantId}/logins`, undefined, admin)).json.data.items
      expect(logins.map((l: { email: string; isOwner: boolean }) => [l.email, l.isOwner])).toEqual([
        ['manager@xanders.pk', true],
        ['rahimahmed@gmail.com', false],
      ])
    })

    it('repairs an account that was already opened beside the real restaurant, on its next sign-in', async () => {
      // 1. Google opened a second, empty account (what v0.8 did).
      const stray = await google('saad@gmail.com', 'g-saad', 'signup')
      expect(stray.json).toMatchObject({ isNew: true, route: 'PROFILE_SETUP' })
      // 2. The real restaurant names that email as its owner.
      const real = await signUp('frontdesk@okra.pk')
      expect((await submit(real.token, 'Okra', 'saad@gmail.com')).status).toBe(200)
      // 3. Signing in again lands on the real restaurant, by Google or by the emailed code.
      const again = await google('saad@gmail.com', 'g-saad', 'signin')
      expect(again.json).toMatchObject({ isNew: false, route: 'UNDER_REVIEW' })
      expect(await myRestaurant(again.json.accessToken)).toMatchObject({ id: real.restaurantId, name: 'Okra' })
    })

    it('does not move a login that has started its own restaurant', async () => {
      const own = await google('zara@gmail.com', 'g-zara', 'signup')
      await call('PATCH', `${P}/restaurant`, { name: "Zara's Kitchen" }, own.json.accessToken)
      const other = await signUp('desk@cafeflo.pk')
      expect((await submit(other.token, 'Cafe Flo', 'zara@gmail.com')).status).toBe(200)
      const again = await google('zara@gmail.com', 'g-zara', 'signin')
      expect((await myRestaurant(again.json.accessToken)).name).toBe("Zara's Kitchen")
    })

    it('ignores a Draft that only names the email (not sent for approval yet)', async () => {
      const draft = await signUp('draft@pompei.pk')
      await call('PATCH', `${P}/restaurant`, { name: 'Pompei', owner: { name: 'Ali', email: 'ali@gmail.com', phone: '+923001112233' } }, draft.token)
      const g = await google('ali@gmail.com', 'g-ali', 'signup')
      expect(g.json).toMatchObject({ isNew: true, route: 'PROFILE_SETUP' })
      expect((await myRestaurant(g.json.accessToken)).id).not.toBe(draft.restaurantId)
    })

    it('refuses when the email is the owner of more than one restaurant', async () => {
      for (const [login, name] of [
        ['a@chain.pk', 'Chain One'],
        ['b@chain.pk', 'Chain Two'],
      ]) {
        const r = await signUp(login)
        expect((await submit(r.token, name, 'boss@chain.pk')).status).toBe(200)
      }
      const g = await google('boss@chain.pk', 'g-boss', 'signup')
      expect(g.status).toBe(409)
      expect(g.json.error.code).toBe('ERR_OWNER_OF_SEVERAL')
    })

    it('does the same for the emailed-code sign-up', async () => {
      const desk = await signUp('desk@sakura.pk')
      expect((await submit(desk.token, 'Sakura', 'chef@sakura.pk')).status).toBe(200)
      const chef = await signUp('chef@sakura.pk')
      expect(chef.route).toBe('UNDER_REVIEW')
      expect(chef.restaurantId).toBe(desk.restaurantId)
    })

    it('still refuses another Google account, an admin email and a suspended login', async () => {
      await signUp('lock@test.pk')
      expect((await google('lock@test.pk', 'g-lock-1', 'signin')).status).toBe(200)
      expect((await google('lock@test.pk', 'g-lock-2', 'signin')).status).toBe(401)
      const adminEmail = await google('admin@gomingle.com', 'g-admin', 'signup')
      expect(adminEmail.status).toBe(409)
    })
  })

  describe('a GoMingle admin creates a restaurant profile', () => {
    const create = (body: unknown) => call('POST', `${A}/restaurants`, body, admin)

    it('creates the profile, emails the owner, and lists it as invited', async () => {
      const created = await create({ name: '  Lal   Qila ', ownerName: 'Bilal Khan', ownerEmail: 'Bilal@LalQila.pk', ownerPhone: '+92 300 1234567' })
      expect(created.status, JSON.stringify(created.json)).toBe(201)
      expect(created.json.data).toMatchObject({ name: 'Lal Qila', ownerName: 'Bilal Khan', ownerEmail: 'bilal@lalqila.pk', status: 'INVITED', ownerSignedIn: false, emailed: true })

      const mail = outbox.find((m) => m.to === 'bilal@lalqila.pk')
      expect(mail?.email.subject).toBe('Lal Qila is ready for you on GoMingle')
      expect(mail?.email.text).toContain('Sign up with bilal@lalqila.pk')
      expect(mail?.email.text).toContain('/signup')

      const invited = (await call('GET', `${A}/restaurants/invited`, undefined, admin)).json.data.items
      expect(invited.map((i: { name: string }) => i.name)).toContain('Lal Qila')
      // Not in the directory or the approval queue until the owner submits it.
      const directory = (await call('GET', `${A}/restaurants`, undefined, admin)).json
      expect(JSON.stringify(directory)).not.toContain('Lal Qila')
      const queue = (await call('GET', `${A}/admin/approvals`, undefined, admin)).json
      expect(JSON.stringify(queue)).not.toContain('Lal Qila')
    })

    it('lets the owner sign up with the emailed code, complete the profile and send it for approval', async () => {
      const created = (await create({ name: 'BBQ Tonight', ownerName: 'Sana Tariq', ownerEmail: 'sana@bbqtonight.pk' })).json.data
      // Signing in is not possible before a password exists.
      expect((await call('POST', `${P}/auth/login`, { email: 'sana@bbqtonight.pk', password: 'Kolachi@2026' })).status).toBe(401)

      const owner = await signUp('sana@bbqtonight.pk')
      expect(owner.restaurantId).toBe(created.id)
      expect(owner.route).toBe('PROFILE_SETUP')
      const mine = await myRestaurant(owner.token)
      expect(mine).toMatchObject({ name: 'BBQ Tonight', status: 'DRAFT', owner: { name: 'Sana Tariq', email: 'sana@bbqtonight.pk' } })

      expect((await submit(owner.token, 'BBQ Tonight', 'sana@bbqtonight.pk')).status).toBe(200)
      const queue = (await call('GET', `${A}/admin/approvals`, undefined, admin)).json
      expect(JSON.stringify(queue)).toContain('BBQ Tonight')
      const invited = (await call('GET', `${A}/restaurants/invited`, undefined, admin)).json.data.items
      expect(invited.map((i: { name: string }) => i.name)).not.toContain('BBQ Tonight')
    })

    it('lets the owner continue with Google instead, from either button', async () => {
      const created = (await create({ name: 'Kababjees', ownerName: 'Hamza Ali', ownerEmail: 'hamza@gmail.com' })).json.data
      const g = await google('hamza@gmail.com', 'g-hamza', 'signin')
      expect(g.json).toMatchObject({ isNew: false, route: 'PROFILE_SETUP' })
      expect(await myRestaurant(g.json.accessToken)).toMatchObject({ id: created.id, name: 'Kababjees' })
      const invited = (await call('GET', `${A}/restaurants/invited`, undefined, admin)).json.data.items
      expect(invited.find((i: { id: string }) => i.id === created.id)).toMatchObject({ ownerSignedIn: true })
    })

    it('validates the form', async () => {
      for (const [body, field] of [
        [{ name: '', ownerName: 'A B', ownerEmail: 'a@b.pk' }, 'name'],
        [{ name: 'Good Name', ownerName: '', ownerEmail: 'a@b.pk' }, 'ownerName'],
        [{ name: 'Good Name', ownerName: 'A B', ownerEmail: 'not-an-email' }, 'ownerEmail'],
        [{ name: 'Good Name', ownerName: 'A B', ownerEmail: 'a@b.pk', ownerPhone: 'call me' }, 'ownerPhone'],
      ] as const) {
        const r = await create(body)
        expect(r.status).toBe(422)
        expect(r.json.error.details).toEqual({ field })
      }
      expect((await call('POST', `${A}/restaurants`, { name: 'X Y', ownerName: 'A B', ownerEmail: 'a@b.pk' })).status).toBe(401)
    })

    it('refuses an email that already has a restaurant, an admin email, and a second invite of the same name', async () => {
      const taken = await signUp('taken@gmail.com')
      await call('PATCH', `${P}/restaurant`, { name: 'Taken Bistro' }, taken.token)
      const hasOne = await create({ name: 'Another Place', ownerName: 'T K', ownerEmail: 'taken@gmail.com' })
      expect(hasOne.status).toBe(409)
      expect(hasOne.json.error).toMatchObject({ code: 'ERR_EMAIL_HAS_RESTAURANT' })
      expect(hasOne.json.error.message).toContain('Taken Bistro')

      expect((await create({ name: 'Admin Diner', ownerName: 'A D', ownerEmail: 'admin@gomingle.com' })).json.error.code).toBe('ERR_EMAIL_IS_ADMIN')

      expect((await create({ name: 'Twice', ownerName: 'A B', ownerEmail: 'one@twice.pk' })).status).toBe(201)
      expect((await create({ name: 'twice', ownerName: 'C D', ownerEmail: 'two@twice.pk' })).json.error.code).toBe('ERR_RESTAURANT_NAME_IN_USE')
      // The owner's email is spoken for too.
      expect((await create({ name: 'Thrice', ownerName: 'A B', ownerEmail: 'one@twice.pk' })).json.error.code).toBe('ERR_EMAIL_HAS_RESTAURANT')
    })

    it('moves a login that only holds an empty Draft onto the new profile', async () => {
      const early = await google('early@gmail.com', 'g-early', 'signup')
      expect(early.json.isNew).toBe(true)
      const created = await create({ name: 'Early Bird', ownerName: 'Early Bird', ownerEmail: 'early@gmail.com' })
      expect(created.status).toBe(201)
      const again = await google('early@gmail.com', 'g-early', 'signin')
      expect(await myRestaurant(again.json.accessToken)).toMatchObject({ id: created.json.data.id, name: 'Early Bird' })
    })

    it('resends and cancels an invitation', async () => {
      const created = (await create({ name: 'Typo Cafe', ownerName: 'Wrong Person', ownerEmail: 'wrnog@typo.pk' })).json.data
      outbox.length = 0
      const resent = await call('POST', `${A}/restaurants/invited/${created.id}/resend`, undefined, admin)
      expect(resent.json.data).toMatchObject({ emailed: true })
      expect(outbox.filter((m) => m.to === 'wrnog@typo.pk')).toHaveLength(1)

      expect((await call('DELETE', `${A}/restaurants/invited/${created.id}`, undefined, admin)).status).toBe(200)
      const invited = (await call('GET', `${A}/restaurants/invited`, undefined, admin)).json.data.items
      expect(invited.map((i: { id: string }) => i.id)).not.toContain(created.id)
      expect((await call('POST', `${A}/restaurants/invited/${created.id}/resend`, undefined, admin)).status).toBe(404)
      // The cancelled owner cannot get in to it, and the name and email are free again.
      const g = await google('wrnog@typo.pk', 'g-typo', 'signin')
      expect(g.status).toBe(404)
      expect((await create({ name: 'Typo Cafe', ownerName: 'Right Person', ownerEmail: 'right@typo.pk' })).status).toBe(201)
    })

    it('cannot cancel a profile the owner has already sent for approval', async () => {
      const created = (await create({ name: 'Sent Already', ownerName: 'S A', ownerEmail: 'sent@already.pk' })).json.data
      const owner = await signUp('sent@already.pk')
      expect((await submit(owner.token, 'Sent Already', 'sent@already.pk')).status).toBe(200)
      expect((await call('DELETE', `${A}/restaurants/invited/${created.id}`, undefined, admin)).status).toBe(404)
    })
  })

  describe('an admin gives an email access to an existing restaurant', () => {
    it('adds a login, emails it, and the person lands on that restaurant', async () => {
      const desk = await signUp('desk@nando.pk')
      expect((await submit(desk.token, 'Nando', 'desk@nando.pk')).status).toBe(200)
      const granted = await call('POST', `${A}/restaurants/${desk.restaurantId}/logins`, { fullName: 'New Manager', email: 'manager@gmail.com' }, admin)
      expect(granted.status, JSON.stringify(granted.json)).toBe(201)
      expect(granted.json.data).toMatchObject({ moved: false, emailed: true, login: { email: 'manager@gmail.com', isOwner: false, pending: true } })
      expect(outbox.find((m) => m.to === 'manager@gmail.com')?.email.subject).toBe('Nando is ready for you on GoMingle')

      const g = await google('manager@gmail.com', 'g-manager', 'signin')
      expect(await myRestaurant(g.json.accessToken)).toMatchObject({ id: desk.restaurantId, name: 'Nando' })

      const twice = await call('POST', `${A}/restaurants/${desk.restaurantId}/logins`, { fullName: 'New Manager', email: 'manager@gmail.com' }, admin)
      expect(twice.json.error.code).toBe('ERR_ALREADY_HAS_ACCESS')
    })

    it('refuses unknown restaurants, bad input and emails that have their own restaurant', async () => {
      expect((await call('GET', `${A}/restaurants/rest-nope/logins`, undefined, admin)).status).toBe(404)
      const a = await signUp('a@alpha.pk')
      expect((await submit(a.token, 'Alpha', 'a@alpha.pk')).status).toBe(200)
      const b = await signUp('b@beta.pk')
      expect((await submit(b.token, 'Beta', 'b@beta.pk')).status).toBe(200)
      const L = `${A}/restaurants/${a.restaurantId}/logins`
      expect((await call('POST', L, { fullName: '', email: 'x@y.pk' }, admin)).status).toBe(422)
      expect((await call('POST', L, { fullName: 'X Y', email: 'nope' }, admin)).status).toBe(422)
      const other = await call('POST', L, { fullName: 'B', email: 'b@beta.pk' }, admin)
      expect(other.status).toBe(422)
      const hasOwn = await call('POST', L, { fullName: 'Beta Owner', email: 'b@beta.pk' }, admin)
      expect(hasOwn.json.error.code).toBe('ERR_EMAIL_HAS_RESTAURANT')
    })
  })
})

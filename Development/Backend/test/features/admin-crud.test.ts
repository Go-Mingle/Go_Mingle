import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'

const A = '/admin/api/v1'
const P = '/partner/api/v1/partner'
const PHOTO = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'E2E', 'tests', 'fixtures', 'dining.jpg'))

/**
 * A super admin can do what the restaurant can on its own screens, archive a
 * restaurant, change a booking's seats, clear the admin inbox and message
 * restaurants, and see every platform timer (GM-342).
 */
describe('admin super-admin CRUD', () => {
  let s: TestServer
  let admin = ''
  let partner = ''
  let rid = ''
  let tableId = ''
  let menuId = ''
  let topicId = ''

  async function call(method: string, url: string, body?: unknown, token?: string) {
    const res = await fetch(s.base + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
  const must = async (method: string, url: string, body: unknown, token: string) => {
    const r = await call(method, url, body, token)
    expect(r.status, `${method} ${url} ${JSON.stringify(r.json)}`).toBeLessThan(300)
    return r.json?.data ?? r.json
  }
  /** A fresh table for 4, published and bookable. */
  async function tableFor4(name: string) {
    const start = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    const it = await must('POST', `${A}/restaurants/${rid}/interest-tables`, {
      name, maxGuests: 4, startDate: start, startTime: '20:00', durationMinutes: 120,
      availabilityMode: 'AVAILABLE_NOW', publish: true, topicId, restaurantTableId: tableId, menuOptionIds: [menuId],
    }, admin)
    return it.id as string
  }
  const book = (interestTableId: string, minglerName: string, seats: number) =>
    call('POST', `${A}/admin/bookings/sandbox`, { interestTableId, minglerName, seats }, admin)
  const seatsBooked = async (id: string) => (await must('GET', `${A}/interest-tables/${id}`, undefined, admin)).seatsBooked as number
  const heldFor = async (minglerName: string) =>
    ((await must('GET', `${A}/escrow`, undefined, admin)).items as Array<{ minglerName: string; status: string }>).filter(
      (h) => h.minglerName === minglerName && (h.status === 'AUTHORIZED' || h.status === 'IN_ESCROW'),
    )

  beforeAll(async () => {
    s = await startTestServer()
    admin = (await call('POST', `${A}/auth/login`, { email: 'admin@gomingle.com', password: 'Admin@123' })).json.accessToken
    const login = (await call('POST', `${P}/auth/login`, { email: 'partner@gomingle.com', password: 'Partner@123' })).json
    partner = login.accessToken ?? login.data.accessToken
    const R = `${P}/restaurant`
    await must('PATCH', R, {
      name: 'Kolachi Seafront', cuisine: 'Pakistani', description: 'Seafront barbecue on Do Darya with a view of the Arabian Sea.',
      location: { areaDistrict: 'DHA Phase 8', city: 'Karachi', fullAddress: 'Do Darya, DHA Phase 8, Karachi', latitude: 24.78, longitude: 67.06 },
      owner: { name: 'Raees Khan', email: 'owner@kolachi.pk', phone: '+923001112233' },
      restaurant: { phone: '+922135250000', email: 'hello@kolachi.pk' },
    }, partner)
    const target = await must('POST', `${R}/photos/upload-url`, { name: 'dining.jpg', contentType: 'image/jpeg' }, partner)
    await fetch(new URL(target.uploadUrl, s.base).toString(), { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: PHOTO })
    await must('POST', `${R}/photos`, { uploadRef: target.uploadRef }, partner)
    await must('PUT', `${R}/payout-account`, { accountTitle: 'Kolachi Pvt Ltd', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' }, partner)
    tableId = (await must('POST', `${R}/tables`, { name: 'Window Table' }, partner)).id
    menuId = (await must('POST', `${R}/menu-options`, { name: 'Signature Set', pricePkr: 3500, courses: [{ course: 'Main', choose: 1, options: ['Biryani', 'Tikka'] }] }, partner)).id
    // A no-show penalty, so every booking places card holds that must not leak.
    await must('PUT', `${R}/no-show-policy`, { penaltyPerSeatPkr: 1500, cancellationWindowHours: 24 }, partner)
    await must('POST', `${R}/submit`, undefined, partner)
    rid = (await must('GET', R, undefined, partner)).id
    const category = await must('POST', `${A}/categories`, { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 20 }, admin)
    await must('POST', `${A}/admin/approvals/${rid}/approve`, { categoryId: category.id }, admin)
    const topics = (await must('GET', `${A}/topics`, undefined, admin)) as { items?: { id: string }[] } | { id: string }[]
    topicId = (Array.isArray(topics) ? topics : (topics.items ?? []))[0]?.id ?? ''
  })
  afterAll(async () => {
    await s?.close()
  })

  /** An admin request on the restaurant's own screens. */
  const asAdmin = async (method: string, url: string, body?: unknown, restaurantId = rid) => {
    const res = await fetch(s.base + url, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}`, 'X-GoMingle-Restaurant': restaurantId },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const text = await res.text()
    return { status: res.status, json: text ? JSON.parse(text) : null }
  }
  const changeLog = async () => (await must('GET', `${A}/change-log`, undefined, admin)) as { module: string; newVal: string }[]

  describe('managing a restaurant on its behalf', () => {
    it('edits the profile, contacts, tables and menus with the restaurant\'s own rules', async () => {
      const R = `${P}/restaurant`
      const edited = await asAdmin('PATCH', R, { description: 'Seafront barbecue, now with a rooftop.' })
      expect(edited.status, JSON.stringify(edited.json)).toBe(200)
      expect((await must('GET', R, undefined, partner)).description).toBe('Seafront barbecue, now with a rooftop.')

      const contact = await asAdmin('POST', `${R}/contacts`, { name: 'Bilal Ahmed', title: 'Head chef', phone: '+923001234567' })
      expect(contact.status).toBe(201)
      expect((await asAdmin('PATCH', `${R}/contacts/${contact.json.data.id}`, { title: 'Executive chef' })).status).toBe(200)

      const table = await asAdmin('POST', `${R}/tables`, { name: 'Rooftop' })
      expect(table.status).toBe(201)
      // The restaurant's rule still applies: names are unique.
      expect((await asAdmin('POST', `${R}/tables`, { name: 'rooftop' })).status).toBe(409)
      expect((await asAdmin('DELETE', `${R}/tables/${table.json.data.tableId}`)).status).toBeLessThan(300)

      const menu = await asAdmin('POST', `${R}/menu-options`, { name: 'Rooftop Set', pricePkr: 4200, courses: [{ course: 'Main', choose: 1, options: ['Fish', 'Prawns'] }] })
      expect(menu.status).toBe(201)

      const log = await changeLog()
      expect(log.some((l) => l.module === 'Restaurants' && /Added contact: Bilal Ahmed \(on the restaurant's behalf\)/.test(l.newVal))).toBe(true)
      expect(log.some((l) => /Added table: Rooftop/.test(l.newVal))).toBe(true)
    })

    it('stays out of everything but the restaurant\'s own screens', async () => {
      expect((await asAdmin('GET', `${P}/users`)).status).toBe(403)
      expect((await asAdmin('GET', `${P}/restaurant`, undefined, 'no-such-restaurant')).status).toBe(404)
      // A partner token cannot borrow the header.
      const res = await fetch(s.base + `${P}/restaurant`, { headers: { Authorization: `Bearer ${partner}`, 'X-GoMingle-Restaurant': rid } })
      expect(res.status).toBe(401)
    })
  })

  describe('archive', () => {
    it('hides an archived restaurant from the app and the directory until it is restored', async () => {
      expect((await call('POST', `${A}/restaurants/${rid}/archive`, { reason: 'short' }, admin)).status).toBe(400)
      const archived = await must('POST', `${A}/restaurants/${rid}/archive`, { reason: 'Closed for renovation until spring.' }, admin)
      expect(archived.status).toBe('ARCHIVED')
      expect((await must('GET', `${P}/restaurant`, undefined, partner)).visibleOnApp).toBe(false)
      const listed = (await must('GET', `${A}/restaurants`, undefined, admin)).items as { id: string }[]
      expect(listed.find((r) => r.id === rid)).toBeUndefined()
      const archivedList = (await must('GET', `${A}/restaurants?statuses=ARCHIVED`, undefined, admin)).items as { id: string }[]
      expect(archivedList.map((r) => r.id)).toContain(rid)
      expect((await call('POST', `${A}/restaurants/${rid}/archive`, { reason: 'Closed for renovation until spring.' }, admin)).status).toBe(409)
      expect((await must('POST', `${A}/restaurants/${rid}/restore`, {}, admin)).status).toBe('ACTIVE')
      expect((await changeLog()).some((l) => l.newVal.startsWith('Archived'))).toBe(true)
    })
  })

  describe('booking seats', () => {
    it('adds and removes seats, keeping one card hold per seat and the table count right', async () => {
      const id = await tableFor4('Chai and Chess')
      const made = await book(id, 'Hamza Seats', 1)
      expect(made.status).toBe(201)
      const bookingId = made.json.data.booking?.id ?? made.json.data.id
      expect((await call('PATCH', `${A}/admin/bookings/${bookingId}`, { seats: 3 }, admin)).status).toBe(200)
      expect(await seatsBooked(id)).toBe(3)
      expect(await heldFor('Hamza Seats')).toHaveLength(3)
      expect((await call('PATCH', `${A}/admin/bookings/${bookingId}`, { seats: 5 }, admin)).status).toBe(409)
      expect((await call('PATCH', `${A}/admin/bookings/${bookingId}`, { seats: 2 }, admin)).status).toBe(200)
      expect(await seatsBooked(id)).toBe(2)
      expect(await heldFor('Hamza Seats')).toHaveLength(2)
      expect((await call('PATCH', `${A}/admin/bookings/${bookingId}`, { seats: 0 }, admin)).status).toBe(422)
    })
  })

  describe('notifications', () => {
    it('messages every live restaurant, and deletes from the admin inbox', async () => {
      expect((await call('POST', `${A}/notifications/broadcast`, { title: '', body: 'x' }, admin)).status).toBe(422)
      const sent = await must('POST', `${A}/notifications/broadcast`, { title: 'Eid timings', body: 'Bookings close at 6 PM on Eid.' }, admin)
      expect(sent.sent).toBeGreaterThanOrEqual(1)
      const inbox = (await must('GET', `${P}/notifications`, undefined, partner)).items as { type: string; title: string }[]
      expect(inbox.some((n) => n.type === 'GOMINGLE_ANNOUNCEMENT' && n.title === 'Eid timings')).toBe(true)

      const mine = (await must('GET', `${A}/notifications`, undefined, admin)).items as { id: string }[]
      expect(mine.length).toBeGreaterThan(0)
      expect((await call('DELETE', `${A}/notifications/${mine[0].id}`, undefined, admin)).status).toBe(200)
      expect((await call('DELETE', `${A}/notifications/${mine[0].id}`, undefined, admin)).status).toBe(404)
    })
  })

  it('lists every platform timer with its value', async () => {
    const timers = (await call('GET', '/admin/api/timer-settings', undefined, admin)).json as { key: string; value: number; source: string }[]
    expect(timers.find((t) => t.key === 'auto-cancel')).toMatchObject({ value: 4, source: 'PLATFORM_FIXED' })
    expect(timers.find((t) => t.key === 'check-in-opens')?.value).toBe(60)
    expect(timers.find((t) => t.key === 'cancellation-window')?.source).toBe('PER_RESTAURANT')
  })
})

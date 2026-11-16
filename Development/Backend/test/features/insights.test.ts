import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'

const A = '/admin/api/v1'
const P = '/partner/api/v1/partner'
const PHOTO = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'E2E', 'tests', 'fixtures', 'dining.jpg'))

/** The dashboards' figures come from real bookings and the escrow ledger. */
describe('dashboard insights', () => {
  let s: TestServer
  let admin = ''
  let partner = ''
  let rid = ''

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

  beforeAll(async () => {
    s = await startTestServer()
    admin = (await call('POST', `${A}/auth/login`, { email: 'admin@gomingle.com', password: 'Admin@123' })).json.accessToken
    const login = (await call('POST', `${P}/auth/login`, { email: 'partner@gomingle.com', password: 'Partner@123' })).json
    partner = login.accessToken ?? login.data.accessToken
    const R = `${P}/restaurant`
    await must('PATCH', R, {
      name: 'Kolachi Seafront',
      cuisine: 'Pakistani',
      description: 'Seafront barbecue on Do Darya with a view of the Arabian Sea.',
      location: { areaDistrict: 'DHA Phase 8', city: 'Karachi', fullAddress: 'Do Darya, DHA Phase 8, Karachi', latitude: 24.78, longitude: 67.06 },
      owner: { name: 'Raees Khan', email: 'owner@kolachi.pk', phone: '+923001112233' },
      restaurant: { phone: '+922135250000', email: 'hello@kolachi.pk' },
    }, partner)
    const target = await must('POST', `${R}/photos/upload-url`, { name: 'dining.jpg', contentType: 'image/jpeg' }, partner)
    await fetch(new URL(target.uploadUrl, s.base).toString(), { method: 'PUT', headers: { 'content-type': 'image/jpeg' }, body: PHOTO })
    await must('POST', `${R}/photos`, { uploadRef: target.uploadRef }, partner)
    await must('PUT', `${R}/payout-account`, { accountTitle: 'Kolachi Pvt Ltd', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' }, partner)
    const table = await must('POST', `${R}/tables`, { name: 'Window Table' }, partner)
    const menu = await must('POST', `${R}/menu-options`, { name: 'Signature Set', pricePkr: 3500, courses: [{ course: 'Main', choose: 1, options: ['Biryani', 'Tikka'] }] }, partner)
    await must('POST', `${R}/submit`, undefined, partner)
    rid = (await must('GET', R, undefined, partner)).id
    const category = await must('POST', `${A}/categories`, { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 4 }, admin)
    await must('POST', `${A}/admin/approvals/${rid}/approve`, { categoryId: category.id }, admin)

    // An interest table next week, with 6 of its 8 seats booked and one booking cancelled.
    const start = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
    const topics = (await must('GET', `${A}/topics`, undefined, admin)) as { items?: { id: string }[] } & { id: string }[]
    const topicId = (Array.isArray(topics) ? topics : (topics.items ?? []))[0]?.id
    const it = await must('POST', `${A}/restaurants/${rid}/interest-tables`, {
      name: 'Startup Mixer', maxGuests: 8, startDate: start, startTime: '19:30', durationMinutes: 150,
      availabilityMode: 'AVAILABLE_NOW', publish: true, topicId, restaurantTableId: table.id, menuOptionIds: [menu.id],
    }, admin)
    const book = (minglerName: string, seats: number) => must('POST', `${A}/admin/bookings/sandbox`, { interestTableId: it.id, minglerName, seats }, admin)
    await book('Sana Khan', 4)
    await book('Osama Siddiqui', 2)
    const gone = await book('Ali Raza', 1)
    await must('POST', `${A}/admin/bookings/${gone.id ?? gone.booking?.id}/cancel`, undefined, admin)

    // Money through escrow: one payment collected, one collected and paid out.
    const pay = async (name: string, guests: number, each: number) =>
      (await must('POST', `${A}/escrow/test-booking`, { restaurantId: rid, minglerName: name, guests, amountPerGuest: each, eventName: 'Startup Mixer' }, admin)).id as string
    const held = await pay('Hina Baig', 2, 4200)
    await must('POST', `${A}/escrow/${held}/capture`, undefined, admin)
    const done = await pay('Zara Ali', 3, 3500)
    await must('POST', `${A}/escrow/${done}/capture`, undefined, admin)
    await must('POST', `${A}/escrow/${done}/release`, undefined, admin)
  })
  afterAll(async () => {
    await s?.close()
  })

  it('gives the partner its own bookings, seats, money and upcoming tables', async () => {
    const d = (await call('GET', `${P}/dashboard?days=7`, undefined, partner)).json.data
    expect(d.days).toBe(7)
    expect(d.daily).toHaveLength(7)
    expect(d.kpis.bookings).toEqual({ value: 3, previous: 0 })
    expect(d.kpis.seats.value).toBe(7)
    // 2 × 4,200 + 3 × 3,500 collected; the released one paid out after the 12% fee.
    expect(d.kpis.collectedPkr.value).toBe(18_900)
    expect(d.kpis.paidOutPkr.value).toBe(9_240)
    expect(d.kpis.feesPkr.value).toBe(1_260)
    expect(d.outcome).toEqual({ upcoming: 2, arrived: 0, partial: 0, noShow: 0, cancelled: 1 })
    expect(d.kpis.upcomingTables).toBe(1)
    expect(d.kpis.upcomingSeats).toEqual({ booked: 6, capacity: 8 })
    expect(d.upcoming[0]).toMatchObject({ name: 'Startup Mixer', maxGuests: 8, bookedSeats: 6, restaurantName: 'Kolachi Seafront' })
    expect(d.escrow).toMatchObject({ inEscrowPkr: 8_400, paidOutPkr: 9_240, feePct: 12 })
    // Everything happened today (Pakistan time): the last day carries it all.
    const today = d.daily.at(-1)
    expect(today).toMatchObject({ date: d.to, bookings: 3, seats: 7, collectedPkr: 18_900, paidOutPkr: 9_240, feesPkr: 1_260 })
    expect(d.daily.slice(0, -1).every((x: { bookings: number; collectedPkr: number }) => x.bookings === 0 && x.collectedPkr === 0)).toBe(true)
    // A restaurant never sees the platform's restaurant ranking.
    expect(d.topRestaurants).toBeUndefined()
  })

  it('gives the admin the platform view, with restaurant counts and the ranking', async () => {
    const d = (await call('GET', `/admin/api/dashboard/overview?days=30`, undefined, admin)).json.data
    expect(d.daily).toHaveLength(30)
    expect(d.kpis.bookings.value).toBe(3)
    expect(d.kpis.collectedPkr.value).toBe(18_900)
    expect(d.restaurants).toEqual({ active: 1, suspended: 0, pendingApproval: 0 })
    expect(d.topRestaurants).toEqual([{ id: rid, name: 'Kolachi Seafront', bookings: 3, collectedPkr: 18_900 }])
  })

  it('falls back to 30 days for an unknown range, and needs a token', async () => {
    expect((await call('GET', `${P}/dashboard?days=999`, undefined, partner)).json.data.days).toBe(30)
    expect((await call('GET', `${P}/dashboard`, undefined, partner)).json.data.days).toBe(30)
    expect((await call('GET', `${P}/dashboard`)).status).toBe(401)
    expect((await call('GET', `/admin/api/dashboard/overview`)).status).toBe(401)
    expect((await call('GET', `/admin/api/dashboard/overview`, undefined, partner)).status).toBe(401)
  })
})

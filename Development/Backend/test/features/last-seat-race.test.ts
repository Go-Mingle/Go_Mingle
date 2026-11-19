import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { startTestServer, type TestServer } from '../helpers/server'

const A = '/admin/api/v1'
const P = '/partner/api/v1/partner'
const PHOTO = fs.readFileSync(path.resolve(__dirname, '..', '..', '..', 'E2E', 'tests', 'fixtures', 'dining.jpg'))

/**
 * Two people reaching for the last seat at the same moment: exactly one gets
 * it, the other is told the table is full, and nobody is left with a card
 * hold for a seat they did not get (GM-330).
 */
describe('the last seat at a table', () => {
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

  it('gives the 4th seat to exactly one of two people booking at once', async () => {
    const id = await tableFor4('Book Club Supper')
    expect((await book(id, 'Ahmed One', 3)).status).toBe(201)
    const [a, b] = await Promise.all([book(id, 'Sara Last', 1), book(id, 'Bilal Last', 1)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    const loser = a.status === 409 ? a : b
    expect(loser.json.error.code).toBe('ERR_TABLE_FULL')
    expect(loser.json.error.message).toBe('Only 0 seats left at this table.')
    expect(await seatsBooked(id)).toBe(4)
    // Whoever lost holds nothing on their card.
    const loserName = a.status === 409 ? 'Sara Last' : 'Bilal Last'
    expect(await heldFor(loserName)).toEqual([])
  })

  it('never seats more than 4, however many people rush an empty table', async () => {
    const id = await tableFor4('Chess and Chai')
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => book(id, `Rusher ${i}`, 1)))
    expect(results.filter((r) => r.status === 201)).toHaveLength(4)
    expect(results.filter((r) => r.status === 409).every((r) => r.json.error.code === 'ERR_TABLE_FULL')).toBe(true)
    expect(await seatsBooked(id)).toBe(4)
    const bookings = (await must('GET', `${A}/admin/bookings?interestTableId=${id}&pageSize=50`, undefined, admin)).items as Array<{ seats: number; status: string }>
    expect(bookings.filter((x) => x.status === 'CONFIRMED').reduce((n, x) => n + x.seats, 0)).toBe(4)
  })

  it('handles groups: 2 + 2 + 2 at once fills the table with two of them', async () => {
    const id = await tableFor4('Founders Breakfast')
    const results = await Promise.all([book(id, 'Group A', 2), book(id, 'Group B', 2), book(id, 'Group C', 2)])
    expect(results.map((r) => r.status).sort()).toEqual([201, 201, 409])
    expect(await seatsBooked(id)).toBe(4)
  })

  it('refuses a group bigger than the seats left, and gives a cancelled seat back', async () => {
    const id = await tableFor4('Karachi Foodies')
    const first = await book(id, 'Early Bird', 3)
    expect(first.status).toBe(201)
    const tooMany = await book(id, 'Pair', 2)
    expect(tooMany.status).toBe(409)
    expect(tooMany.json.error.message).toBe('Only 1 seat left at this table.')
    await must('POST', `${A}/admin/bookings/${first.json.data.booking.id}/cancel`, undefined, admin)
    expect(await seatsBooked(id)).toBe(0)
    expect((await book(id, 'Pair', 2)).status).toBe(201)
    expect(await seatsBooked(id)).toBe(2)
  })
})

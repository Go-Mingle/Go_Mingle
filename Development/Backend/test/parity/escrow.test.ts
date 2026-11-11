import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type PerSide } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const R = `${P}/restaurant`
const AD = '/admin/api/v1'
const E = `${AD}/escrow`
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

/** Safepay escrow (simulator): hold → capture → release / refund, and void. */
describe('parity: escrow', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start()
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('matches the old API', async () => {
    await p.loginPartner()
    await p.loginAdmin()
    const A = { as: 'partner' }
    const AA = { as: 'admin' }
    // Booking references and payout references are random.
    const ignoreRefs = (prefix: string) => [`${prefix}bookingRef`, `${prefix}payout.reference`]
    const pause = () => new Promise((r) => setTimeout(r, 15))

    await p.req('console empty', 'GET', E, AA)
    await p.req('partner escrow empty', 'GET', `${P}/escrow`, A)
    await p.req('no token', 'GET', E)
    await p.req('partner token', 'GET', E, A)
    await p.req('test booking unknown restaurant', 'POST', `${E}/test-booking`, { ...AA, body: { restaurantId: 'nope' } })
    await p.req('test booking draft restaurant', 'POST', `${E}/test-booking`, { ...AA, body: { restaurantId: 'rest1' } })
    await p.req('capture unknown', 'POST', `${E}/esc-nope/capture`, AA)
    await p.req('unknown action', 'POST', `${E}/esc-nope/settle`, AA)

    // A live restaurant, without a payout account at first
    await p.req('profile', 'PATCH', R, {
      ...A,
      body: {
        name: 'Kolachi',
        cuisine: 'Pakistani',
        description: 'Seafront barbecue.',
        location: { areaDistrict: 'DHA', city: 'Karachi', fullAddress: 'Do Darya, Karachi', latitude: 24.78, longitude: 67.06 },
        owner: { name: 'Raees Khan', email: 'o@kolachi.pk', phone: '+923001112233' },
        restaurant: { phone: '+922135250000', email: 'hi@kolachi.pk' },
      },
    })
    const photo = await p.req('photo target', 'POST', `${R}/photos/upload-url`, { ...A, body: { name: 'dining.jpg', contentType: 'image/jpeg' } })
    await p.req('photo put', 'PUT', (s) => photo.get('data.uploadUrl')[s], { raw: { old: JPEG, neu: JPEG }, contentType: 'image/jpeg', compare: false })
    await p.req('photo commit', 'POST', `${R}/photos`, { ...A, body: (s) => ({ uploadRef: photo.get('data.uploadRef')[s] }) })
    await p.req('payout', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: 'Kolachi Pvt', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' } })
    const submitted = await p.req('submit', 'POST', `${R}/submit`, A)
    const cat = (await p.req('category', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Premium', commissionRate: 10, interestTablesPerMonth: 4 } })).get('id')
    // The category takes 10%, which is also the flat fee the old API always charged, so the two agree here.
    // The new server splits by the category's rate (see the 12% category in arrival-no-show.test.ts).
    const approved = await p.req('approve', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: (s) => ({ categoryId: cat[s] }) })
    expect([submitted.neu.status, approved.neu.status, approved.old.status]).toEqual([200, 200, 200])
    await p.req('console lists the restaurant', 'GET', E, AA)

    const book = async (step: string, body: object): Promise<PerSide<string>> => {
      const r = await p.req(step, 'POST', `${E}/test-booking`, { ...AA, ignore: ignoreRefs('data.'), body: { restaurantId: 'rest1', ...body } })
      expect([r.old.status, r.neu.status], step).toEqual([201, 201])
      expect(r.neu.json.data.bookingRef).toMatch(/^GM-\d{6}$/)
      await pause()
      return r.get('data.id')
    }
    const act = (step: string, id: PerSide<string>, action: string, body: object = {}) =>
      p.req(step, 'POST', (s) => `${E}/${id[s]}/${action}`, { ...AA, ignore: ignoreRefs('data.'), body })

    await p.req('booking with no amount', 'POST', `${E}/test-booking`, { ...AA, body: { restaurantId: 'rest1', guests: 0 } })
    await p.req('booking with bad amount', 'POST', `${E}/test-booking`, { ...AA, body: { restaurantId: 'rest1', amountPerGuest: 'lots' } })
    const b1 = await book('booking', { minglerName: ' Sana Khan ', guests: 4, amountPerGuest: 3333.335, eventName: 'Startup Mixer' })
    const b2 = await book('booking defaults', {})
    const b3 = await book('booking 3', { minglerName: 'Osama', guests: 1, amountPerGuest: 999.99 })
    const b4 = await book('booking 4', { minglerName: 'Hina', guests: 3, amountPerGuest: 2500 })

    // Wrong order
    await act('release before capture', b1, 'release')
    await act('refund before capture', b1, 'refund', { reason: 'x' })
    // Capture → escrow
    await act('capture', b1, 'capture')
    await act('capture again', b1, 'capture')
    await act('void after capture', b1, 'void')
    await act('refund without reason', b1, 'refund', { reason: '  ' })
    // Void an uncaptured hold
    await act('void', b2, 'void', { reason: 'Cancelled in time' })
    await act('capture voided', b2, 'capture')
    // Refund
    await act('capture 3', b3, 'capture')
    await act('refund', b3, 'refund', { reason: ' Dispute upheld ' })
    await act('refund again', b3, 'refund', { reason: 'again' })
    // Release
    await act('release', b1, 'release')
    await act('release again', b1, 'release')
    await act('capture 4', b4, 'capture')

    const items = (prefix: string) => [0, 1, 2, 3].flatMap((i) => ignoreRefs(`${prefix}.${i}.`))
    await p.req('console', 'GET', E, { ...AA, ignore: items('data.items') })
    for (const status of ['AUTHORIZED', 'IN_ESCROW', 'RELEASED', 'REFUNDED', 'VOIDED', 'NOPE']) {
      await p.req(`console ${status}`, 'GET', `${E}?status=${status}`, { ...AA, ignore: items('data.items') })
    }
    await p.req('partner escrow', 'GET', `${P}/escrow`, { ...A, ignore: items('data.items') })

    // The partner hears about money held and paid
    const inbox = await p.req('partner inbox', 'GET', `${P}/notifications?sortDir=asc`, { ...A, compare: false })
    const strip = (j: any) => j.data.items.map((n: { type: string; title: string; body: string }) => [n.type, n.title, n.body.replace(/GM-\d{6}/, 'GM-x')]).sort()
    expect(strip(inbox.neu.json)).toEqual(strip(inbox.old.json))
    expect(strip(inbox.neu.json).filter((n: string[]) => n[0] === 'PAYOUT_RELEASED')).toHaveLength(1)

    // A restaurant without a bank account cannot be paid
    await p.req('signup start', 'POST', `${P}/signup/start`, { body: { email: 'owner@bbq.pk' } })
    const verified = await p.req('signup verify', 'POST', `${P}/signup/verify`, { body: { email: 'owner@bbq.pk', code: '123456' } })
    p.tokens.bbq = verified.get('data.session.accessToken')
    await p.req('other escrow is empty', 'GET', `${P}/escrow`, { as: 'bbq' })

    await p.req('change log', 'GET', `${AD}/change-log`, AA)

    // Dashboard: the old API answered with fixed sample figures (PKR 148,320 revenue, 7 restaurants).
    // The new one reports what is in the database: one released payout of 13,333.34 at a 10% fee.
    const revenue = await p.req('dashboard revenue', 'GET', '/admin/api/dashboard/revenue-chart', { ...AA, compare: false })
    expect(revenue.neu.json).toEqual({ total: 1333.33, commissions: 1333.33, penalties: 0, commissionPct: 100, penaltyPct: 0, trend: '+100%' })
    expect(Object.keys(revenue.neu.json).sort()).toEqual(Object.keys(revenue.old.json).sort())
    const stats = await p.req('dashboard stats', 'GET', '/admin/api/dashboard/stats', { ...AA, compare: false })
    expect(stats.neu.json).toMatchObject({ activeRestaurants: 1, pendingApprovals: 0, activeMinglers: 0, earnings: 1333.33, oldestPendingDays: 0 })
    expect(Object.keys(stats.neu.json).sort()).toEqual(Object.keys(stats.old.json).sort())
    await p.req('dashboard bookings chart', 'GET', '/admin/api/dashboard/bookings-chart', AA)
    await p.req('dashboard no token', 'GET', '/admin/api/dashboard/stats')
    await p.req('overview legacy list', 'GET', '/partner/api/restaurants', A)
    await p.req('overview legacy restaurant', 'GET', '/partner/api/restaurants/rest1', A)
    await p.req('legacy mingler', 'GET', '/partner/api/minglers/m1', A)

    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])
  }, 180_000)
})

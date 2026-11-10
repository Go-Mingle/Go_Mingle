import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type StepResult } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const R = `${P}/restaurant`
const AD = '/admin/api/v1'
const BK = `${AD}/admin/bookings`
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

/** Karachi date and time, `minutes` from now. */
function karachi(minutes: number) {
  const k = new Date(Date.now() + 5 * 3_600_000 + minutes * 60_000).toISOString()
  return { startDate: k.slice(0, 10), startTime: k.slice(11, 16) }
}

/**
 * GM-204 no-show policy, GM-38 "Guests Arrived", GM-203 no-show penalty.
 * These routes are new: there is no old API to compare with, so this scenario
 * always runs against the new server and its saved answers.
 */
describe('arrival and no-show', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start('arrival-no-show', { newOnly: true })
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('works end to end', async () => {
    await p.loginPartner()
    await p.loginAdmin()
    const A = { as: 'partner' }
    const AA = { as: 'admin' }
    const data = (r: StepResult) => r.neu.json.data

    // ── GM-204: the policy ────────────────────────────────────────────────
    const policy = `${R}/no-show-policy`
    expect(data(await p.req('policy default', 'GET', policy, A))).toMatchObject({ penaltyPerSeatPkr: 0, cancellationWindowHours: 24 })
    await p.req('policy no token', 'GET', policy)
    await p.req('policy empty body', 'PUT', policy, { ...A, body: {} })
    await p.req('policy negative', 'PUT', policy, { ...A, body: { penaltyPerSeatPkr: -1, cancellationWindowHours: 1.5 } })
    await p.req('policy too large', 'PUT', policy, { ...A, body: { penaltyPerSeatPkr: 100001, cancellationWindowHours: 169 } })
    await p.req('policy as text', 'PUT', policy, { ...A, body: { penaltyPerSeatPkr: '500', cancellationWindowHours: '24' } })
    // Zero is a valid policy.
    expect((await p.req('policy zero', 'PUT', policy, { ...A, body: { penaltyPerSeatPkr: 0, cancellationWindowHours: 0 } })).neu.status).toBe(200)

    // A live restaurant
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
    await p.req('photo put', 'PUT', () => data(photo).uploadUrl, { raw: { old: JPEG, neu: JPEG }, contentType: 'image/jpeg', compare: false })
    await p.req('photo commit', 'POST', `${R}/photos`, { ...A, body: { uploadRef: data(photo).uploadRef } })
    await p.req('payout', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: 'Kolachi Pvt', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' } })
    await p.req('submit', 'POST', `${R}/submit`, A)
    const cat = (await p.req('category', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 4 } })).neu.json.id
    expect((await p.req('approve', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: { categoryId: cat } })).neu.status).toBe(200)

    const table = async (step: string, name: string, minutesFromNow: number, extra: object = {}) => {
      const r = await p.req(step, 'POST', `${AD}/restaurants/rest1/interest-tables`, {
        ...AA,
        compare: false,
        body: { name, maxGuests: 8, durationMinutes: 120, availabilityMode: 'AVAILABLE_NOW', publish: true, ...karachi(minutesFromNow), ...extra },
      })
      expect(r.neu.status, step).toBe(201)
      return data(r).id as string
    }
    // One card hold per seat: Safepay cannot collect part of a hold, so the empty seats' holds are
    // collected in full and the others are let go.
    type Hold = { id: string; amount: number; status: string; kind: string; seatNo: number }
    const book = async (step: string, interestTableId: string, body: object = {}) => {
      const r = await p.req(step, 'POST', `${BK}/sandbox`, { ...AA, compare: false, body: { interestTableId, ...body } })
      expect(r.neu.status, step).toBe(201)
      return data(r) as { booking: { id: string; bookingRef: string }; holds: Hold[]; heldTotalPkr: number }
    }
    const rows = async (step: string, tableId: string) => {
      const r = await p.req(step, 'GET', `${P}/interest-tables/${tableId}/bookings`, { ...A, compare: false })
      return data(r).items as Record<string, unknown>[]
    }
    const console_ = async () => data(await p.req('escrow console', 'GET', `${AD}/escrow`, { ...AA, compare: false }))
    /** `[seatNo, status, amount]` of a booking's holds. */
    const holdsOf = async (b: { holds: Hold[] }) => {
      const items = (await console_()).items as Hold[]
      return b.holds.map((h) => items.find((x) => x.id === h.id)).map((h) => [h?.seatNo, h?.status, h?.amount])
    }

    // ── Booking under a zero policy: no card hold ─────────────────────────
    const tonight = await table('table tonight', 'Startup Mixer', -30)
    await p.req('sandbox no table', 'POST', `${BK}/sandbox`, { ...AA, body: {} })
    await p.req('sandbox unknown table', 'POST', `${BK}/sandbox`, { ...AA, body: { interestTableId: 'it-nope' } })
    await p.req('sandbox bad seats', 'POST', `${BK}/sandbox`, { ...AA, body: { interestTableId: tonight, seats: 0 } })
    await p.req('sandbox too many seats', 'POST', `${BK}/sandbox`, { ...AA, body: { interestTableId: tonight, seats: 9 } })
    const free = await book('booking with no penalty', tonight, { minglerName: ' Sana Khan ', seats: 2 })
    expect(free).toMatchObject({ holds: [], heldTotalPkr: 0 })

    // ── The policy changes: only new bookings get it ──────────────────────
    expect(data(await p.req('policy 1500', 'PUT', policy, { ...A, body: { penaltyPerSeatPkr: 1500, cancellationWindowHours: 12 } }))).toMatchObject({ penaltyPerSeatPkr: 1500, cancellationWindowHours: 12 })
    const osama = await book('booking with penalty', tonight, { minglerName: 'Osama', seats: 3 })
    expect(osama.heldTotalPkr).toBe(4500)
    expect(osama.holds.map((h) => [h.seatNo, h.amount, h.status, h.kind])).toEqual([
      [1, 1500, 'AUTHORIZED', 'NO_SHOW_HOLD'],
      [2, 1500, 'AUTHORIZED', 'NO_SHOW_HOLD'],
      [3, 1500, 'AUTHORIZED', 'NO_SHOW_HOLD'],
    ])
    const hina = await book('booking 3', tonight, { minglerName: 'Hina', seats: 2 })
    // A no-show hold is settled by its booking, not by hand from the escrow console.
    await p.req('capture a no-show hold by hand', 'POST', `${AD}/escrow/${hina.holds[0].id}/capture`, AA)
    await p.req('void a no-show hold by hand', 'POST', `${AD}/escrow/${hina.holds[0].id}/void`, AA)
    const bilal = await book('booking 4', tonight, { seats: 1 })
    await p.req('table is full', 'POST', `${BK}/sandbox`, { ...AA, body: { interestTableId: tonight, seats: 1 } })
    let list = await rows('partner bookings', tonight)
    expect(list.map((b) => [b.minglerName, b.seats, b.penaltyPerSeatPkr, b.status, b.cancellable, b.canMarkNoShow])).toEqual([
      ['Sana Khan', 2, 0, 'CONFIRMED', true, true],
      ['Osama', 3, 1500, 'CONFIRMED', true, true],
      ['Hina', 2, 1500, 'CONFIRMED', true, true],
      ['Test Mingler', 1, 1500, 'CONFIRMED', true, true],
    ])
    await p.req('partner booking detail', 'GET', `${P}/bookings/${osama.booking.id}`, { ...A, ignore: ['data.bookingRef', 'data.time', 'data.date'] })
    await p.req('partner booking unknown', 'GET', `${P}/bookings/bk-nope`, A)
    await p.req('admin bookings of table', 'GET', `${BK}?interestTableId=${tonight}&sortBy=mingler&sortOrder=asc`, { ...AA, compare: false })
    await p.req('admin bookings confirmed page 2', 'GET', `${BK}?interestTableId=${tonight}&status=CONFIRMED&pageSize=3&page=2`, { ...AA, compare: false })
    await p.req('admin booking by ref', 'GET', `${BK}/${osama.booking.bookingRef}`, { ...AA, ignore: ['data.bookingRef', 'data.time', 'data.date'] })
    await p.req('admin booking unknown', 'GET', `${BK}/bk-nope`, AA)
    await p.req('admin bookings no scope', 'GET', BK, AA)

    // ── GM-203: no-show, by staff ─────────────────────────────────────────
    await p.req('no-show unknown booking', 'POST', `${P}/bookings/bk-nope/no-show`, A)
    await p.req('no-show bad seats', 'POST', `${P}/bookings/${osama.booking.id}/no-show`, { ...A, body: { emptySeats: 4 } })
    await p.req('no-show zero seats', 'POST', `${P}/bookings/${osama.booking.id}/no-show`, { ...A, body: { emptySeats: 0 } })
    // Two of Osama's three seats stayed empty: two holds are collected in full, the third is let go.
    const partial = data(await p.req('no-show two of three', 'POST', `${P}/bookings/${osama.booking.id}/no-show`, { ...A, ignore: ['data.bookingRef', 'data.date'], body: { emptySeats: 2 } }))
    expect(partial).toMatchObject({ status: 'COMPLETED', attendance: 'PARTIAL', arrivedSeats: 1, emptySeats: 2, penaltyChargedPkr: 3000, penaltyStatus: 'CHARGED', cancellable: false, canMarkNoShow: false })
    expect(await holdsOf(osama)).toEqual([
      [1, 'IN_ESCROW', 1500],
      [2, 'IN_ESCROW', 1500],
      [3, 'VOIDED', 1500],
    ])
    await p.req('no-show again', 'POST', `${P}/bookings/${osama.booking.id}/no-show`, A)
    // A booking made under the zero policy: recorded, nothing charged.
    expect(data(await p.req('no-show with no penalty', 'POST', `${P}/bookings/${free.booking.id}/no-show`, { ...A, ignore: ['data.bookingRef', 'data.date'] }))).toMatchObject({
      attendance: 'NO_SHOW',
      emptySeats: 2,
      penaltyChargedPkr: 0,
      penaltyStatus: null,
    })
    // Cancelled by the restaurant: seat back, hold let go, no charge.
    await p.req('cancel booking', 'POST', `${P}/bookings/${bilal.booking.id}/cancel`, A)
    await p.req('cancel again', 'POST', `${P}/bookings/${bilal.booking.id}/cancel`, A)
    await p.req('no-show cancelled booking', 'POST', `${P}/bookings/${bilal.booking.id}/no-show`, A)
    expect(await holdsOf(bilal)).toEqual([[1, 'VOIDED', 1500]])

    // ── GM-38: Guests Arrived ─────────────────────────────────────────────
    await p.req('arrived unknown table', 'POST', `${P}/interest-tables/it-nope/guests-arrived`, A)
    const arrived = data(await p.req('guests arrived', 'POST', `${P}/interest-tables/${tonight}/guests-arrived`, A))
    expect(arrived).toEqual({ interestTableId: tonight, status: 'COMPLETED', bookingsCheckedIn: 1, seatsArrived: 2 })
    expect(await holdsOf(hina)).toEqual([
      [1, 'VOIDED', 1500],
      [2, 'VOIDED', 1500],
    ])
    list = await rows('partner bookings after', tonight)
    expect(list.map((b) => [b.minglerName, b.status, b.attendance, b.penaltyChargedPkr])).toEqual([
      ['Sana Khan', 'COMPLETED', 'NO_SHOW', 0],
      ['Osama', 'COMPLETED', 'PARTIAL', 3000],
      ['Hina', 'COMPLETED', 'ARRIVED', null],
      ['Test Mingler', 'CANCELLED', null, null],
    ])
    const detail = data(await p.req('table completed', 'GET', `${P}/interest-tables/${tonight}`, { ...A, compare: false }))
    expect(detail).toMatchObject({ status: 'COMPLETED', canCheckIn: false })
    await p.req('arrived twice', 'POST', `${P}/interest-tables/${tonight}/guests-arrived`, A)
    await p.req('booking on a completed table', 'POST', `${BK}/sandbox`, { ...AA, body: { interestTableId: tonight, seats: 1 } })

    // ── Too early ─────────────────────────────────────────────────────────
    const nextWeek = await table('table next week', 'Friday Wine Evening', 7 * 24 * 60)
    const early = await book('booking next week', nextWeek, { minglerName: 'Zain', seats: 2 })
    await p.req('arrived too early', 'POST', `${P}/interest-tables/${nextWeek}/guests-arrived`, { ...A, ignore: ['error.details'] })
    await p.req('no-show too early', 'POST', `${P}/bookings/${early.booking.id}/no-show`, { ...A, ignore: ['error.details'] })
    expect((await rows('early bookings', nextWeek))[0]).toMatchObject({ canMarkNoShow: false, cancellable: true })
    const soon = await table('table in 30 minutes', 'Chai & Conversations', 30)
    await book('booking soon', soon, { seats: 2 })
    expect(data(await p.req('soon detail', 'GET', `${P}/interest-tables/${soon}`, { ...A, compare: false }))).toMatchObject({ canCheckIn: true })
    expect(data(await p.req('arrived shortly before the start', 'POST', `${P}/interest-tables/${soon}/guests-arrived`, A))).toMatchObject({ seatsArrived: 2 })
    const empty = await table('table without bookings', 'Book Club', -10)
    await p.req('arrived with no bookings', 'POST', `${P}/interest-tables/${empty}/guests-arrived`, A)

    // ── The automatic check ───────────────────────────────────────────────
    const missed = await table('table two hours ago', 'Rooftop Social', -120)
    const ghost = await book('booking nobody checked in', missed, { minglerName: 'Yasmeen', seats: 2 })
    const recent = await table('table 20 minutes ago', 'Brunch Club', -20)
    await book('booking within the grace hour', recent, { seats: 1 })
    expect(data(await p.req('no-show check', 'POST', `${BK}/no-show-check`, AA))).toEqual({ checked: 3, noShows: 1 })
    expect(data(await p.req('no-show check again', 'POST', `${BK}/no-show-check`, AA))).toEqual({ checked: 2, noShows: 0 })
    expect((await rows('missed bookings', missed))[0]).toMatchObject({ status: 'COMPLETED', attendance: 'NO_SHOW', emptySeats: 2, penaltyChargedPkr: 3000 })
    expect(await holdsOf(ghost)).toEqual([
      [1, 'IN_ESCROW', 1500],
      [2, 'IN_ESCROW', 1500],
    ])
    expect(data(await p.req('missed table completed', 'GET', `${P}/interest-tables/${missed}`, { ...A, compare: false })).status).toBe('COMPLETED')

    // ── Money: the penalty reaches the restaurant, GoMingle's fee is "penalties" ──
    expect((await p.req('release penalty', 'POST', `${AD}/escrow/${osama.holds[0].id}/release`, { ...AA, compare: false })).neu.status).toBe(200)
    expect((await p.req('dashboard revenue', 'GET', '/admin/api/dashboard/revenue-chart', { ...AA, compare: false })).neu.json).toMatchObject({
      total: 150,
      commissions: 0,
      penalties: 150,
      penaltyPct: 100,
    })

    // ── A collection the gateway refuses is never lost ───────────────────
    const late = await table('table five minutes ago', 'Supper Club', -5)
    const farid = await book('booking whose collection fails', late, { minglerName: 'Farid', seats: 2 })
    expect((await console_()).paymentFailures).toEqual([])
    process.env.GM_SIMULATE_CAPTURE_FAILURE = '1'
    try {
      expect(data(await p.req('no-show, gateway down', 'POST', `${P}/bookings/${farid.booking.id}/no-show`, { ...A, ignore: ['data.bookingRef', 'data.date'] }))).toMatchObject({
        attendance: 'NO_SHOW',
        penaltyChargedPkr: 0,
        penaltyStatus: 'FAILED',
      })
      const failures = (await console_()).paymentFailures as { id: number; seatNo: number; action: string; amount: number; minglerName: string; restaurantName: string; attempts: number; message: string }[]
      expect(failures.map((f) => [f.seatNo, f.action, f.amount, f.minglerName, f.restaurantName, f.attempts, f.message]).sort()).toEqual([
        [1, 'capture', 1500, 'Farid', 'Kolachi', 1, 'Simulated capture failure'],
        [2, 'capture', 1500, 'Farid', 'Kolachi', 1, 'Simulated capture failure'],
      ])
      const [first, second] = failures.sort((a, b) => a.seatNo - b.seatNo)
      await p.req('retry while still failing', 'POST', `${AD}/escrow/failures/${first.id}/retry`, { ...AA, compare: false, allowServerError: true }).then((r) => expect(r.neu.status).toBe(502))
      expect(((await console_()).paymentFailures as { id: number; attempts: number }[]).find((f) => f.id === first.id)?.attempts).toBe(2)

      // The gateway is back: the retry collects the hold and the booking shows it.
      delete process.env.GM_SIMULATE_CAPTURE_FAILURE
      expect((await p.req('retry', 'POST', `${AD}/escrow/failures/${first.id}/retry`, { ...AA, compare: false })).neu.json).toEqual({ success: true, data: { id: first.id, resolved: true } })
      expect((await rows('booking after one retry', late))[0]).toMatchObject({ penaltyChargedPkr: 1500, penaltyStatus: 'FAILED' })
      expect(await holdsOf(farid)).toEqual([
        [1, 'IN_ESCROW', 1500],
        [2, 'AUTHORIZED', 1500],
      ])
      await p.req('retry a resolved failure', 'POST', `${AD}/escrow/failures/${first.id}/retry`, { ...AA, compare: false }).then((r) => expect(r.neu.status).toBe(404))
      await p.req('retry an unknown failure', 'POST', `${AD}/escrow/failures/nope/retry`, AA)
      // The other one is settled by hand and closed with a note.
      await p.req('close without a note', 'POST', `${AD}/escrow/failures/${second.id}/resolve`, { ...AA, compare: false, body: { note: ' ' } }).then((r) => expect(r.neu.status).toBe(422))
      await p.req('close with a note', 'POST', `${AD}/escrow/failures/${second.id}/resolve`, { ...AA, compare: false, body: { note: 'Paid in cash at the restaurant' } }).then((r) => expect(r.neu.status).toBe(200))
      expect((await console_()).paymentFailures).toEqual([])
      // Closing it lets the hold go: nothing stays reserved on the Mingler's card.
      expect(await holdsOf(farid)).toEqual([
        [1, 'IN_ESCROW', 1500],
        [2, 'VOIDED', 1500],
      ])
      // The booking itself is settled: it cannot be checked in a second time.
      await p.req('no-show again after failures', 'POST', `${P}/bookings/${farid.booking.id}/no-show`, A)
    } finally {
      delete process.env.GM_SIMULATE_CAPTURE_FAILURE
    }

    // ── Who hears about it ────────────────────────────────────────────────
    const adminInbox = data(await p.req('admin inbox', 'GET', `${AD}/notifications?pageSize=50`, { ...AA, compare: false })).items.map((n: { type: string }) => n.type)
    expect(adminInbox.filter((t: string) => t === 'BOOKING_NO_SHOW')).toHaveLength(4)
    expect(adminInbox.filter((t: string) => t === 'PAYMENT_FAILED')).toHaveLength(1)
    expect(adminInbox.filter((t: string) => t === 'INTEREST_TABLE_COMPLETED')).toHaveLength(2)
    const partnerInbox = data(await p.req('partner inbox', 'GET', `${P}/notifications`, { ...A, compare: false })).items.map((n: { type: string }) => n.type)
    expect(partnerInbox.filter((t: string) => t === 'BOOKING_NO_SHOW')).toHaveLength(1)

    // ── Another restaurant cannot touch these ─────────────────────────────
    await p.req('signup start', 'POST', `${P}/signup/start`, { body: { email: 'owner@bbq.pk' } })
    const verified = await p.req('signup verify', 'POST', `${P}/signup/verify`, { body: { email: 'owner@bbq.pk', code: '123456' } })
    p.tokens.bbq = verified.get('data.session.accessToken')
    await p.req('other restaurant bookings', 'GET', `${P}/interest-tables/${nextWeek}/bookings`, { as: 'bbq' })
    await p.req('other restaurant no-show', 'POST', `${P}/bookings/${early.booking.id}/no-show`, { as: 'bbq' })
    await p.req('other restaurant policy is its own', 'GET', policy, { as: 'bbq' })

    expect(p.differences, p.report()).toEqual([])
  }, 180_000)
})

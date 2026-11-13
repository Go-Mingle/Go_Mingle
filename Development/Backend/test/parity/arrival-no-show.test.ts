import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type StepResult } from '../helpers/parity'
import { outbox } from '../../src/shared/email/mail-transport'

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

    // A table takes bookings only before it starts. Tables meant to have started already are
    // created three hours ahead, booked there, and moved to their real time straight in the
    // database, as if the bookings had been made earlier.
    const intended = new Map<string, number>()
    const moveTo = async (tableId: string, minutesFromNow: number) => {
      const k = karachi(minutesFromNow)
      await p.neu.database.pool.query('UPDATE interest_tables SET start_date = $1, start_time = $2 WHERE id = $3', [k.startDate, k.startTime, tableId])
    }
    const table = async (step: string, name: string, minutesFromNow: number, extra: object = {}) => {
      const r = await p.req(step, 'POST', `${AD}/restaurants/rest1/interest-tables`, {
        ...AA,
        compare: false,
        body: { name, maxGuests: 8, durationMinutes: 120, availabilityMode: 'AVAILABLE_NOW', publish: true, ...karachi(Math.max(minutesFromNow, 180)), ...extra },
      })
      expect(r.neu.status, step).toBe(201)
      const id = data(r).id as string
      intended.set(id, minutesFromNow)
      if (minutesFromNow < 180) await moveTo(id, minutesFromNow)
      return id
    }
    // One card hold per seat: Safepay cannot collect part of a hold, so the empty seats' holds are
    // collected in full and the others are let go.
    type Hold = { id: string; amount: number; status: string; kind: string; seatNo: number }
    const book = async (step: string, interestTableId: string, body: object = {}) => {
      const at = intended.get(interestTableId)
      if (at !== undefined && at < 180) await moveTo(interestTableId, 180)
      const r = await p.req(step, 'POST', `${BK}/sandbox`, { ...AA, compare: false, body: { interestTableId, ...body } })
      if (at !== undefined && at < 180) await moveTo(interestTableId, at)
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
    const osama = await book('booking with penalty', tonight, { minglerName: 'Osama', minglerEmail: 'osama@example.com', seats: 3 })
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
    // The Mingler is emailed what was charged and why.
    const penaltyMail = outbox.find((m) => m.to === 'osama@example.com')
    expect(penaltyMail?.email.subject).toMatch(/^No-show penalty for .+ \(GM-\d{6}\)$/)
    expect(penaltyMail?.email.text).toContain('2 of the 3 seats')
    expect(penaltyMail?.email.text).toContain('PKR 1,500 for each empty seat, PKR 3,000 in total')
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
      // 12% of the PKR 1,500 penalty: the commission rate of the restaurant's category.
      total: 180,
      commissions: 0,
      penalties: 180,
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

    // ── The card step, done by an admin until the Mingler app exists (GM-255) ──
    const cardTable = await table('table for the card step', 'Chef’s Table', -3)
    process.env.GM_SIMULATE_PENDING_CARD = '1'
    let waiting: Awaited<ReturnType<typeof book>>
    let unpaid: Awaited<ReturnType<typeof book>>
    try {
      // As with real Safepay keys: the holds wait for a card nobody has entered.
      waiting = await book('booking waiting for a card', cardTable, { minglerName: 'Mehwish', seats: 2 })
      unpaid = await book('booking never paid', cardTable, { minglerName: 'Rahim', seats: 1 })
    } finally {
      delete process.env.GM_SIMULATE_PENDING_CARD
    }
    expect(waiting.holds.map((h) => h.status)).toEqual(['PENDING_PAYMENT', 'PENDING_PAYMENT'])
    const card = (id: string) => `${AD}/escrow/${id}/test-card`
    const visa = { cardNumber: '4111 1111 1111 1111', expMonth: 12, expYear: new Date().getFullYear() + 2, cvc: '123' }
    await p.req('card: a real-looking number is refused', 'POST', card(waiting.holds[0].id), { ...AA, body: { ...visa, cardNumber: '4539 1488 0343 6467' } })
    await p.req('card: bad expiry and code', 'POST', card(waiting.holds[0].id), { ...AA, body: { ...visa, expMonth: 13, cvc: '12' } })
    await p.req('card: expired', 'POST', card(waiting.holds[0].id), { ...AA, body: { ...visa, expMonth: 1, expYear: new Date().getFullYear() - 1 } })
    await p.req('card: declined', 'POST', card(waiting.holds[0].id), { ...AA, body: { ...visa, cardNumber: '4000000000000002' } })
    await p.req('card: unknown hold', 'POST', card('esc-nope'), { ...AA, body: visa })
    // One card covers every seat of the booking.
    const added = data(await p.req('card: added', 'POST', card(waiting.holds[1].id), { ...AA, compare: false, body: visa }))
    expect(added.items.map((h: { seatNo: number; status: string; testCard: object }) => [h.seatNo, h.status, h.testCard])).toEqual([
      [1, 'AUTHORIZED', { brand: 'Visa', last4: '1111' }],
      [2, 'AUTHORIZED', { brand: 'Visa', last4: '1111' }],
    ])
    await p.req('card: already added', 'POST', card(waiting.holds[0].id), { ...AA, body: visa })
    expect(data(await p.req('no-show after the card', 'POST', `${P}/bookings/${waiting.booking.id}/no-show`, { ...A, compare: false }))).toMatchObject({ penaltyChargedPkr: 3000, penaltyStatus: 'CHARGED' })
    // No card yet: the no-show cannot collect, the admin adds the card and retries.
    expect(data(await p.req('no-show before the card', 'POST', `${P}/bookings/${unpaid.booking.id}/no-show`, { ...A, compare: false }))).toMatchObject({ penaltyChargedPkr: 0, penaltyStatus: 'FAILED' })
    const stuck = (await console_()).paymentFailures as { id: number; message: string }[]
    expect(stuck.map((f) => f.message)).toEqual(['No card was added for this seat, so there is nothing to collect. Add a card to the booking, then retry.'])
    expect((await p.req('card: added late', 'POST', card(unpaid.holds[0].id), { ...AA, compare: false, body: { ...visa, cardNumber: '5555555555554444' } })).neu.status).toBe(200)
    expect((await p.req('retry after the card', 'POST', `${AD}/escrow/failures/${stuck[0].id}/retry`, { ...AA, compare: false })).neu.status).toBe(200)
    expect((await rows('card bookings', cardTable)).map((b) => [b.minglerName, b.penaltyChargedPkr, b.penaltyStatus])).toEqual([
      ['Mehwish', 3000, 'CHARGED'],
      ['Rahim', 1500, 'CHARGED'],
    ])
    expect((await console_()).paymentFailures).toEqual([])

    // ── The dinner bill and Finances ──────────────────────────────────────
    // Nothing above had a menu option, so nothing was billed: only the penalties are in Finances.
    const FIN = `${AD}/admin/finances`
    const PFIN = `${P}/finances`
    type Fin = { bookingRef: string; totalAmountPkr: number; partnerSharePkr: number; gomingleSharePkr: number; billPkr: number; penaltyPkr: number }
    const adminLedger = async (step: string, query = '') => data(await p.req(step, 'GET', `${FIN}${query}`, { ...AA, compare: false })).items as Fin[]
    const before = await adminLedger('finances: penalties only')
    expect(before.every((r) => r.billPkr === 0 && r.penaltyPkr > 0)).toBe(true)

    const courses = [{ course: 'Main Course', choose: 1, options: ['Chicken Karahi', 'Grilled Fish'] }]
    await p.req('menu option', 'POST', `${R}/menu-options`, { ...A, compare: false, body: { name: 'Seafront Set', pricePkr: 3200, courses } })
    const dinner = await table('table with a menu', 'Seafront Supper', -10, { menuOptionIds: ['c-1'] })
    const ayesha = await book('booking at a priced table', dinner, { minglerName: 'Ayesha', seats: 4 })
    const zain = await book('booking that half shows', dinner, { minglerName: 'Zain', seats: 2 })
    await p.req('admin booking with seat price', 'GET', `${BK}/${ayesha.booking.id}`, { ...AA, ignore: ['data.bookingRef', 'data.time', 'data.date', 'data.id'] })
    // One of Zain's two seats stays empty: that seat pays the penalty, the other its dinner.
    expect(data(await p.req('half no-show', 'POST', `${P}/bookings/${zain.booking.id}/no-show`, { ...A, compare: false, body: { emptySeats: 1 } }))).toMatchObject({
      attendance: 'PARTIAL',
      penaltyChargedPkr: 1500,
      billPkr: 3200,
    })
    expect(data(await p.req('guests arrived at the priced table', 'POST', `${P}/interest-tables/${dinner}/guests-arrived`, { ...A, compare: false }))).toMatchObject({ status: 'COMPLETED', seatsArrived: 4 })
    expect((await rows('billed bookings', dinner)).map((b) => [b.minglerName, b.seats, b.attendance, b.billPkr, b.penaltyChargedPkr])).toEqual([
      ['Ayesha', 4, 'ARRIVED', 12800, null],
      ['Zain', 2, 'PARTIAL', 3200, 1500],
    ])
    // The bills are in escrow, the penalty holds of the seats that arrived were let go.
    type Line = { id: string; bookingRef: string; kind?: string; status: string; amount: number; gateway: string }
    const bills = ((await console_()).items as Line[]).filter((h) => h.kind === 'BILL')
    expect(bills.map((h) => [h.status, h.amount, h.gateway]).sort()).toEqual([
      ['IN_ESCROW', 12800, 'Simulated'],
      ['IN_ESCROW', 3200, 'Simulated'],
    ])
    expect(await holdsOf(ayesha)).toEqual([1, 2, 3, 4].map((n) => [n, 'VOIDED', 1500]))

    // Admin Finances: one row per booking, split by the platform fee.
    const fee = (n: number) => Math.round(n * 12) / 100 // the Premium category takes 12%
    const mine = (await adminLedger('finances: with bills')).filter((r) => [ayesha.booking.bookingRef, zain.booking.bookingRef].includes(r.bookingRef))
    expect(mine.map((r) => [r.bookingRef, r.totalAmountPkr, r.billPkr, r.penaltyPkr, r.gomingleSharePkr, r.partnerSharePkr]).sort()).toEqual(
      [
        [ayesha.booking.bookingRef, 12800, 12800, 0, fee(12800), 12800 - fee(12800)],
        [zain.booking.bookingRef, 4700, 3200, 1500, fee(4700), 4700 - fee(4700)],
      ].sort(),
    )
    expect((await adminLedger('finances: search by mingler', '?mingler=ayesh')).map((r) => r.bookingRef)).toEqual([ayesha.booking.bookingRef])
    expect((await adminLedger('finances: sorted by total', '?sortBy=total&sortOrder=desc&pageSize=1'))[0].bookingRef).toBe(ayesha.booking.bookingRef)
    expect(await adminLedger('finances: nothing that long ago', '?dateFrom=2020-01-01&dateTo=2020-12-31')).toEqual([])
    await p.req('finances: bad date range', 'GET', `${FIN}?dateFrom=2026-02-01&dateTo=2026-01-01`, AA)
    await p.req('finances: no token', 'GET', FIN)
    await p.req('finances: detail', 'GET', `${FIN}/${ayesha.booking.bookingRef}`, { ...AA, ignore: ['data.bookingRef', 'data.date', 'data.eventStart', 'data.eventEnd'] })
    await p.req('finances: unknown booking', 'GET', `${FIN}/GM-000000`, AA)
    // The export is a short-lived signed link to the CSV.
    const link = data(await p.req('finances: export link', 'GET', `${FIN}/export?mingler=Ayesha`, { ...AA, compare: false })).url as string
    const csv = await p.req('finances: export file', 'GET', new URL(link).pathname + new URL(link).search, { compare: false })
    expect(csv.neu.status).toBe(200)
    expect(csv.neu.text.trim().split('\n')).toHaveLength(2)
    expect(csv.neu.text).toContain(`Kolachi,${ayesha.booking.bookingRef},Seafront Supper,Ayesha,12800,`)
    await p.req('finances: export link tampered', 'GET', `${new URL(link).pathname}?token=abc.def`)

    // Partner Finances: the same bookings, with the restaurant's share.
    const partnerLedger = data(await p.req('partner finances', 'GET', `${PFIN}?searchField=interestTable&search=seafront`, { ...A, compare: false })).items as {
      bookingId: string
      bookingRef: string
      totalAmountPkr: number
      mySharePkr: number
      interestTable: { name: string }
    }[]
    expect(partnerLedger.map((r) => [r.bookingRef, r.totalAmountPkr, r.mySharePkr]).sort()).toEqual(
      [
        [ayesha.booking.bookingRef, 12800, 12800 - fee(12800)],
        [zain.booking.bookingRef, 4700, 4700 - fee(4700)],
      ].sort(),
    )
    await p.req('partner finances: detail', 'GET', `${PFIN}/${ayesha.booking.id}`, { ...A, ignore: ['data.bookingRef', 'data.date'] })
    await p.req('partner finances: this month', 'GET', `${PFIN}?period=THIS_MONTH&pageSize=50`, { ...A, compare: false })
    await p.req('partner finances: bad period', 'GET', `${PFIN}?period=LAST_WEEK`, A)
    const pcsv = await p.req('partner finances: export', 'GET', `${PFIN}/export?searchField=mingler&search=Zain`, { ...A, compare: false })
    expect(pcsv.neu.text).toContain(`${zain.booking.bookingRef},Zain,Seafront Supper,`)

    // Paying the restaurant: the bill is released from escrow, less the fee.
    const ayeshaBill = bills.find((h) => h.bookingRef === ayesha.booking.bookingRef)!
    expect(data(await p.req('release the bill', 'POST', `${AD}/escrow/${ayeshaBill.id}/release`, { ...AA, compare: false }))).toMatchObject({
      status: 'RELEASED',
      payout: { amount: 12800 - fee(12800), platformFee: fee(12800) },
    })
    // Still one Finances row, now paid out.
    expect((await adminLedger('finances: after payout', `?bookingRef=${ayesha.booking.bookingRef}`)).map((r) => [r.totalAmountPkr, (r as Fin & { paidOut: boolean }).paidOut])).toEqual([[12800, true]])

    // A table without a menu option: a sandbox booking can bring its own dinner price.
    const plain = await table('table without a menu', 'Chai Circle', -5)
    const typed = await book('booking with a typed price', plain, { minglerName: 'Nida', seats: 2, seatPricePkr: 900 })
    expect((typed.booking as unknown as { seatPricePkr: number }).seatPricePkr).toBe(900)
    // The menu option's price wins over a typed one.
    const menuWins = await table('second table with a menu', 'Seafront Lunch', 600, { menuOptionIds: ['c-1'] })
    expect(((await book('typed price ignored', menuWins, { seats: 1, seatPricePkr: 5 })).booking as unknown as { seatPricePkr: number }).seatPricePkr).toBe(3200)
    await p.req('guests arrived at the plain table', 'POST', `${P}/interest-tables/${plain}/guests-arrived`, { ...A, compare: false })
    expect((await adminLedger('finances: typed price', `?bookingRef=${typed.booking.bookingRef}`)).map((r) => [r.totalAmountPkr, r.billPkr])).toEqual([[1800, 1800]])

    // Safepay's checkout needs real keys; without them the admin is told to use a test card.
    await p.req('checkout without keys', 'POST', `${AD}/escrow/${ayeshaBill.id}/checkout`, { ...AA, body: { returnUrl: 'http://localhost:5173/finances/escrow' } })
    await p.req('confirm a checkout never opened', 'POST', `${AD}/escrow/${ayeshaBill.id}/checkout/confirm`, { ...AA, compare: false })

    // ── Times are Pakistan time; a table that started takes no bookings ──────
    const startedTable = await table('table that started an hour ago', 'Late Lunch', -60)
    const lateBooking = await p.req('booking a started table', 'POST', `${BK}/sandbox`, { ...AA, compare: false, body: { interestTableId: startedTable, seats: 1 } })
    expect([lateBooking.neu.status, lateBooking.neu.json?.error?.code]).toEqual([409, 'ERR_TABLE_STARTED'])
    const pastPublish = await p.req('publish a table in the past', 'POST', `${AD}/restaurants/rest1/interest-tables`, {
      ...AA,
      compare: false,
      body: { name: 'Too Late', maxGuests: 8, durationMinutes: 60, availabilityMode: 'AVAILABLE_NOW', publish: true, ...karachi(-5) },
    })
    expect([pastPublish.neu.status, pastPublish.neu.json?.error?.code]).toEqual([422, 'ERR_START_IN_PAST'])
    const pastDraft = await p.req('a draft may have any time', 'POST', `${AD}/restaurants/rest1/interest-tables`, {
      ...AA,
      compare: false,
      body: { name: 'Draft Later', maxGuests: 8, durationMinutes: 60, publish: false, ...karachi(-5) },
    })
    expect(pastDraft.neu.status).toBe(201)

    // ── Editing, deleting and cancelling a table ─────────────────────────────
    const maxBelow = await p.req('max guests below booked seats', 'PATCH', `${AD}/interest-tables/${menuWins}`, { ...AA, compare: false, body: { maxGuests: 0 } })
    expect([maxBelow.neu.status, maxBelow.neu.json?.error?.code]).toEqual([409, 'ERR_BELOW_BOOKED'])
    const renamed = await p.req('rename a live table', 'PATCH', `${AD}/interest-tables/${menuWins}`, { ...AA, compare: false, body: { name: 'Seafront Long Lunch', maxGuests: 6 } })
    expect([renamed.neu.status, data(renamed).name, data(renamed).maxGuests]).toEqual([200, 'Seafront Long Lunch', 6])
    const deleteBooked = await p.req('delete a table with bookings', 'DELETE', `${AD}/interest-tables/${menuWins}`, { ...AA, compare: false })
    expect([deleteBooked.neu.status, deleteBooked.neu.json?.error?.code]).toEqual([409, 'ERR_HAS_BOOKINGS'])
    expect((await p.req('delete an empty table', 'DELETE', `${AD}/interest-tables/${data(pastDraft).id}`, { ...AA, compare: false })).neu.status).toBe(200)

    // Cancelling the table cancels its bookings and gives every Mingler's money back.
    const lunchBooking = (await rows('lunch bookings', menuWins))[0] as { bookingRef: string; status: string }
    const cancelled = data(await p.req('cancel a booked table', 'POST', `${AD}/interest-tables/${menuWins}/cancel`, { ...AA, compare: false }))
    expect(cancelled).toMatchObject({ status: 'CANCELLED', cancelledCount: 1, refundedPkr: 1500 })
    expect((await rows('lunch bookings after cancel', menuWins)).map((b) => b.status)).toEqual(['CANCELLED'])
    const lunchHolds = ((await console_()).items as (Hold & { bookingRef: string })[]).filter((h) => h.bookingRef === lunchBooking.bookingRef)
    expect(lunchHolds.map((h) => h.status)).toEqual(['VOIDED'])
    const again = await p.req('cancel it again', 'POST', `${AD}/interest-tables/${menuWins}/cancel`, { ...AA, compare: false })
    expect(again.neu.status).toBe(409)
    const editCancelled = await p.req('edit a cancelled table', 'PATCH', `${AD}/interest-tables/${menuWins}`, { ...AA, compare: false, body: { name: 'x' } })
    expect(editCancelled.neu.status).toBe(409)

    // A booking left open on a table cancelled earlier is cancelled by the next check, money back.
    const leftOpen = await table('table cancelled the old way', 'Old Cancel', 300)
    const oldBooking = await book('booking on it', leftOpen, { minglerName: 'Bilal', seats: 2 })
    await p.neu.database.pool.query("UPDATE interest_tables SET status = 'CANCELLED' WHERE id = $1", [leftOpen])
    await p.req('no-show check repairs it', 'POST', `${BK}/no-show-check`, { ...AA, compare: false })
    expect((await rows('old cancel bookings', leftOpen)).map((b) => b.status)).toEqual(['CANCELLED'])
    expect((await holdsOf(oldBooking)).map(([, status]) => status)).toEqual(['VOIDED', 'VOIDED'])

    // ── Who hears about it ────────────────────────────────────────────────
    const adminInbox = data(await p.req('admin inbox', 'GET', `${AD}/notifications?pageSize=50`, { ...AA, compare: false })).items.map((n: { type: string }) => n.type)
    expect(adminInbox.filter((t: string) => t === 'BOOKING_NO_SHOW')).toHaveLength(7)
    expect(adminInbox.filter((t: string) => t === 'PAYMENT_FAILED')).toHaveLength(2)
    expect(adminInbox.filter((t: string) => t === 'INTEREST_TABLE_COMPLETED')).toHaveLength(4)
    const partnerInbox = data(await p.req('partner inbox', 'GET', `${P}/notifications`, { ...A, compare: false })).items.map((n: { type: string }) => n.type)
    expect(partnerInbox.filter((t: string) => t === 'BOOKING_NO_SHOW')).toHaveLength(1)
    // One per dinner bill that went into escrow.
    expect(partnerInbox.filter((t: string) => t === 'ESCROW_FUNDED')).toHaveLength(3)

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

import type { Insights } from '../../app/visual/insights'

const DAY = 86_400_000
/** Deterministic 0..1 noise so the mock dashboard looks the same on every load. */
const noise = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}
const sum = (rows: Insights['daily'], pick: (r: Insights['daily'][number]) => number) =>
  rows.reduce((t, r) => t + pick(r), 0)

/** A plausible platform dashboard for the mock (offline) mode. */
export function mockDashboardOverview(days: number): Insights {
  const today = Date.now()
  const make = (offset: number) =>
    Array.from({ length: days }, (_, i) => {
      const n = noise(i + offset)
      const weekend = new Date(today - (days - 1 - i + offset) * DAY).getDay() % 6 === 5 ? 1.6 : 1
      const bookings = Math.round((2 + n * 6) * weekend)
      const seats = bookings * 3
      const collectedPkr = seats * 3500
      const paidOutPkr = Math.round(collectedPkr * 0.85 * 0.88)
      return {
        date: new Date(today - (days - 1 - i + offset) * DAY).toISOString().slice(0, 10),
        bookings,
        seats,
        collectedPkr,
        paidOutPkr,
        feesPkr: Math.round(paidOutPkr * (12 / 88)),
      }
    })
  const daily = make(0)
  const before = make(days)
  const pair = (pick: (r: Insights['daily'][number]) => number) => ({
    value: sum(daily, pick),
    previous: sum(before, pick),
  })
  const bookings = sum(daily, (r) => r.bookings)
  const at = (d: number, h: number) => new Date(today + d * DAY + h * 3_600_000).toISOString()
  return {
    days,
    from: daily[0].date,
    to: daily[daily.length - 1].date,
    kpis: {
      bookings: pair((r) => r.bookings),
      seats: pair((r) => r.seats),
      collectedPkr: pair((r) => r.collectedPkr),
      paidOutPkr: pair((r) => r.paidOutPkr),
      feesPkr: pair((r) => r.feesPkr),
      upcomingTables: 4,
      upcomingSeats: { booked: 19, capacity: 28 },
    },
    daily,
    outcome: {
      arrived: Math.round(bookings * 0.62),
      partial: Math.round(bookings * 0.12),
      noShow: Math.round(bookings * 0.04),
      cancelled: Math.round(bookings * 0.07),
      upcoming:
        bookings -
        Math.round(bookings * 0.62) -
        Math.round(bookings * 0.12) -
        Math.round(bookings * 0.04) -
        Math.round(bookings * 0.07),
    },
    escrow: {
      heldPkr: 42_000,
      inEscrowPkr: 96_600,
      paidOutPkr: 1_284_300,
      refundedPkr: 31_500,
      feePct: 12,
    },
    upcoming: [
      {
        id: 'it-1',
        name: 'Startup Mixer',
        restaurantId: 'r1',
        restaurantName: 'Kolachi',
        startsAt: at(1, 2),
        maxGuests: 8,
        bookedSeats: 6,
      },
      {
        id: 'it-2',
        name: 'Book Club Supper',
        restaurantId: 'r2',
        restaurantName: 'Café Flo',
        startsAt: at(3, 3),
        maxGuests: 6,
        bookedSeats: 4,
      },
      {
        id: 'it-3',
        name: 'Chess & Chai',
        restaurantId: 'r3',
        restaurantName: 'Tuscany Courtyard',
        startsAt: at(5, 1),
        maxGuests: 6,
        bookedSeats: 6,
      },
      {
        id: 'it-4',
        name: 'Founders Breakfast',
        restaurantId: 'r1',
        restaurantName: 'Kolachi',
        startsAt: at(8, -6),
        maxGuests: 8,
        bookedSeats: 3,
      },
    ],
    topRestaurants: [
      {
        id: 'r1',
        name: 'Kolachi',
        bookings: Math.round(bookings * 0.34),
        collectedPkr: Math.round(sum(daily, (r) => r.collectedPkr) * 0.34),
      },
      {
        id: 'r3',
        name: 'Tuscany Courtyard',
        bookings: Math.round(bookings * 0.25),
        collectedPkr: Math.round(sum(daily, (r) => r.collectedPkr) * 0.26),
      },
      {
        id: 'r2',
        name: 'Café Flo',
        bookings: Math.round(bookings * 0.21),
        collectedPkr: Math.round(sum(daily, (r) => r.collectedPkr) * 0.19),
      },
      {
        id: 'r4',
        name: 'Xanders',
        bookings: Math.round(bookings * 0.12),
        collectedPkr: Math.round(sum(daily, (r) => r.collectedPkr) * 0.13),
      },
      {
        id: 'r5',
        name: 'Okra',
        bookings: Math.round(bookings * 0.08),
        collectedPkr: Math.round(sum(daily, (r) => r.collectedPkr) * 0.08),
      },
    ],
    restaurants: { active: 7, suspended: 1, pendingApproval: 5 },
  }
}

/** A figure for the chosen period beside the same figure for the period before it. */
export interface Pair {
  value: number
  previous: number
}

/** What both dashboards draw. Mirrors the API's InsightsService.overview. */
export interface Insights {
  days: number
  from: string
  to: string
  kpis: {
    bookings: Pair
    seats: Pair
    collectedPkr: Pair
    paidOutPkr: Pair
    feesPkr: Pair
    upcomingTables: number
    upcomingSeats: { booked: number; capacity: number }
  }
  daily: {
    date: string
    bookings: number
    seats: number
    collectedPkr: number
    paidOutPkr: number
    feesPkr: number
  }[]
  outcome: { upcoming: number; arrived: number; partial: number; noShow: number; cancelled: number }
  escrow: {
    heldPkr: number
    inEscrowPkr: number
    paidOutPkr: number
    refundedPkr: number
    feePct: number
  }
  upcoming: {
    id: string
    name: string
    restaurantId: string
    restaurantName: string
    startsAt: string
    maxGuests: number
    bookedSeats: number
  }[]
  /** Platform view only. */
  topRestaurants?: { id: string; name: string; bookings: number; collectedPkr: number }[]
  /** Platform view only. */
  restaurants?: { active: number; suspended: number; pendingApproval: number }
}

export const RANGES = [7, 30, 90] as const
export type Range = (typeof RANGES)[number]

export const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString('en-US')}`

/** "Fri 27 Nov, 7:30 pm" in Pakistan time. */
export function whenPk(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(iso))
    .replace(' at ', ', ')
}

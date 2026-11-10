import { HttpResponse } from 'msw'
import { errorResponse, mockProfile } from './partnerRestaurantProfile'
import type {
  BookingDetail,
  InterestTableBookingRow,
  InterestTableDetail,
  InterestTableListItem,
  InterestTableMenuOption,
  InviteeRow,
  MinglerProfile,
} from '../../app/modules/restaurants/partnerInterestTables/types'

/**
 * J6F interest-table fixtures — the partner's read-only mirror of the admin views.
 *
 * Mirrors the real strictness rather than the happy path, because the awkward
 * branches are the ones worth catching:
 *
 * - `it-draft` exists in the store but is **never** listed and 404s on every
 *   detail read, including a direct deep link (BR-03).
 * - `it-open` is not Invite Only, so its invitee read answers
 *   `inviteOnly: false, items: []` — the tab is meant to disappear, not to show an
 *   empty state.
 * - Both Promingler kinds are represented, plus a table with none.
 * - Bookings cover a null bill, a non-cancellable terminal row, and a Promingler
 *   row that refuses cancellation with its own code.
 * - Invitees cover all three statuses, only one of which is cancellable.
 * - `m-quiet` answers every eating-preference question with an empty array, which
 *   is what makes the client's "Not specified" rendering provable.
 * - `m-unknown` is a Mingler with no booking or invite here, so it 404s — the
 *   "Profile unavailable" path, which is expected rather than a bug.
 *
 * Dates and times are **pre-formatted display strings** (`DD-MM-YYYY`, `h:mm A`),
 * exactly as the real endpoints send them. Feeding these through `dayjs()` would
 * yield `Invalid Date`, which is precisely the trap the client's `format.ts` exists
 * to avoid — so the fixtures must not be "helpfully" made ISO.
 */

const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."
const IT_NOT_FOUND = 'Interest table not found.'
const BOOKING_NOT_FOUND = 'Booking not found.'
const INVITE_NOT_FOUND = 'Invite not found.'
const PROFILE_UNAVAILABLE = 'Profile unavailable.'

interface MockTable extends InterestTableDetail {
  /** Draft rows are held so the exclusion can be exercised, never served. */
  isDraft: boolean
  imageUrl: string | null
  seatsBooked: number
}

function seedTables(): MockTable[] {
  return [
    {
      interestTableId: 'it-1',
      name: 'Friday Wine Evening',
      topic: 'Wine & Dine',
      assignedTable: 'Terrace',
      imageUrl: 'https://cdn.gomingle.com/interest-tables/it-1.jpg',
      startDate: '28-04-2026',
      startTime: '7:00 PM',
      durationMinutes: 120,
      minGuests: 4,
      maxGuests: 8,
      seatsBooked: 5,
      seatsLeft: 3,
      availabilityMode: 'AVAILABLE_NOW',
      inviteOnly: true,
      proMingler: { name: 'Sana Khan', kind: 'ADMIN_ASSIGNED' },
      status: 'CONFIRMED',
      createdAt: '02-04-2026 14:30',
      copyLinkEligible: true,
      isDraft: false,
    },
    {
      // Not Invite Only — its Invited tab must not render at all.
      interestTableId: 'it-open',
      name: 'Sunday Brunch Social',
      topic: 'Brunch',
      assignedTable: 'Garden Patio',
      imageUrl: null,
      startDate: '03-05-2026',
      startTime: '12:00 PM',
      durationMinutes: 90,
      minGuests: 4,
      maxGuests: 6,
      seatsBooked: 2,
      seatsLeft: 4,
      availabilityMode: 'AVAILABLE_NOW',
      inviteOnly: false,
      proMingler: { name: 'Osama Hashmi', kind: 'SELF_CLAIMED' },
      status: 'PENDING',
      createdAt: '10-04-2026 09:05',
      copyLinkEligible: true,
      isDraft: false,
    },
    {
      interestTableId: 'it-soon',
      name: "Chef's Counter Tasting",
      topic: 'Tasting Menu',
      assignedTable: "Chef's Counter",
      imageUrl: null,
      startDate: '18-06-2026',
      startTime: '8:00 PM',
      durationMinutes: 150,
      minGuests: 4,
      maxGuests: 8,
      seatsBooked: 0,
      seatsLeft: 8,
      availabilityMode: 'COMING_SOON',
      inviteOnly: false,
      proMingler: { name: '', kind: 'NONE' },
      status: 'COMING_SOON',
      createdAt: '20-04-2026 11:00',
      copyLinkEligible: true,
      isDraft: false,
    },
    {
      // Cancelled → no Copy Link, per the server's own flag.
      interestTableId: 'it-cancelled',
      name: 'Rooftop Jazz Supper',
      topic: 'Live Music',
      assignedTable: 'Rooftop Deck',
      imageUrl: null,
      startDate: '12-03-2026',
      startTime: '9:00 PM',
      durationMinutes: 120,
      minGuests: 4,
      maxGuests: 8,
      seatsBooked: 0,
      seatsLeft: 8,
      availabilityMode: 'AVAILABLE_NOW',
      inviteOnly: false,
      proMingler: { name: '', kind: 'NONE' },
      status: 'CANCELLED',
      createdAt: '01-03-2026 16:45',
      copyLinkEligible: false,
      isDraft: false,
    },
    {
      interestTableId: 'it-done',
      name: 'Mezze & Mingle',
      topic: 'Levantine',
      assignedTable: 'Window Table',
      imageUrl: null,
      startDate: '02-02-2026',
      startTime: '7:30 PM',
      durationMinutes: 120,
      minGuests: 4,
      maxGuests: 8,
      seatsBooked: 8,
      seatsLeft: 0,
      availabilityMode: 'AVAILABLE_NOW',
      inviteOnly: true,
      proMingler: { name: 'Sana Khan', kind: 'ADMIN_ASSIGNED' },
      status: 'COMPLETED',
      createdAt: '10-01-2026 10:00',
      copyLinkEligible: true,
      isDraft: false,
    },
    {
      // Never listed, never readable — the Draft exclusion (BR-03).
      interestTableId: 'it-draft',
      name: 'Unpublished Idea',
      topic: 'TBD',
      assignedTable: 'Terrace',
      imageUrl: null,
      startDate: '01-08-2026',
      startTime: '7:00 PM',
      durationMinutes: 120,
      minGuests: 4,
      maxGuests: 8,
      seatsBooked: 0,
      seatsLeft: 8,
      availabilityMode: 'COMING_SOON',
      inviteOnly: false,
      proMingler: { name: '', kind: 'NONE' },
      status: 'PENDING',
      createdAt: '25-04-2026 12:00',
      copyLinkEligible: true,
      isDraft: true,
    },
  ]
}

function seedMenuOptions(): Record<string, InterestTableMenuOption[]> {
  return {
    'it-1': [
      {
        name: 'Wagyu Experience',
        pricePkr: 480,
        courses: [
          { course: 'Starters', choose: 1, options: ['Burrata', 'Tuna Tartare'] },
          { course: 'Main Course', choose: 1, options: ['Wagyu Striploin', 'Grilled Sea Bass'] },
          { course: 'Desserts', choose: 1, options: ['Kunafa', 'Chocolate Fondant'] },
        ],
      },
      {
        name: 'Mezze Feast for 2',
        pricePkr: 260,
        courses: [
          {
            course: 'Mezze',
            choose: 4,
            options: ['Hummus', 'Moutabal', 'Tabbouleh', 'Fattoush', 'Warak Enab'],
          },
        ],
      },
    ],
    'it-open': [],
    'it-done': [
      {
        name: 'Levantine Set',
        pricePkr: 195,
        courses: [{ course: 'Main Course', choose: 1, options: ['Mixed Grill', 'Sayadieh'] }],
      },
    ],
  }
}

function seedBookings(): Record<string, InterestTableBookingRow[]> {
  return {
    'it-1': [
      {
        bookingId: 'bk-1',
        bookingRef: 'BK-10043',
        minglerId: 'm-sana',
        minglerName: 'Sana Khan',
        // The table's Promingler — refused with its own code, not the generic one.
        proMingler: { isProMingler: true, kind: 'ADMIN_ASSIGNED' },
        menuOption: 'Wagyu Experience',
        date: '28-04-2026',
        billPkr: 1840,
        status: 'CONFIRMED',
        cancellable: false,
      },
      {
        bookingId: 'bk-2',
        bookingRef: 'BK-10044',
        minglerId: 'm-parveen',
        minglerName: 'Parveen Rizvi',
        proMingler: { isProMingler: false, kind: 'NONE' },
        menuOption: 'Mezze Feast for 2',
        date: '28-04-2026',
        billPkr: 3200,
        status: 'CONFIRMED',
        cancellable: true,
      },
      {
        bookingId: 'bk-3',
        bookingRef: 'BK-10045',
        minglerId: 'm-quiet',
        minglerName: 'Laiba Naseer',
        proMingler: { isProMingler: false, kind: 'NONE' },
        menuOption: 'Wagyu Experience',
        date: '28-04-2026',
        // Uncharged — must render as an em dash, never `PKR 0`.
        billPkr: null,
        status: 'PENDING',
        cancellable: true,
      },
      {
        bookingId: 'bk-4',
        bookingRef: 'BK-10046',
        minglerId: 'm-osama',
        minglerName: 'Osama Hashmi',
        proMingler: { isProMingler: false, kind: 'NONE' },
        menuOption: 'Mezze Feast for 2',
        date: '28-04-2026',
        billPkr: 980,
        status: 'COMPLETED',
        cancellable: false,
      },
    ],
    'it-open': [],
    'it-done': [
      {
        bookingId: 'bk-9',
        bookingRef: 'BK-10001',
        minglerId: 'm-sana',
        minglerName: 'Sana Khan',
        proMingler: { isProMingler: true, kind: 'SELF_CLAIMED' },
        menuOption: 'Levantine Set',
        date: '02-02-2026',
        billPkr: 640,
        status: 'COMPLETED',
        cancellable: false,
      },
    ],
  }
}

function seedInvitees(): Record<string, InviteeRow[]> {
  return {
    'it-1': [
      {
        inviteeId: 'inv-1',
        minglerId: 'm-parveen',
        minglerName: 'Parveen Rizvi',
        dateInvited: '09-06-2026',
        inviteStatus: 'INVITED',
        cancellable: true,
      },
      {
        // Converted to a booking — no Cancel Invite; cancellation goes via the booking.
        inviteeId: 'inv-2',
        minglerId: 'm-sana',
        minglerName: 'Sana Khan',
        dateInvited: '08-06-2026',
        inviteStatus: 'TABLE_BOOKED',
        cancellable: false,
      },
      {
        inviteeId: 'inv-3',
        minglerId: 'm-osama',
        minglerName: 'Osama Hashmi',
        dateInvited: '07-06-2026',
        inviteStatus: 'CANCELLED',
        cancellable: false,
      },
    ],
    'it-done': [
      {
        inviteeId: 'inv-9',
        minglerId: 'm-sana',
        minglerName: 'Sana Khan',
        dateInvited: '05-01-2026',
        inviteStatus: 'TABLE_BOOKED',
        cancellable: false,
      },
    ],
  }
}

function seedMinglers(): Record<string, MinglerProfile> {
  return {
    'm-sana': {
      minglerId: 'm-sana',
      fullName: 'Sana Khan',
      isProMingler: true,
      proMinglerKind: 'ADMIN_ASSIGNED',
      minglerSince: '10 Jan 2024',
      accountStatus: 'ACTIVE',
      eatingPreferences: [
        { question: 'Culinary Restrictions', answers: ['Halal Only'] },
        { question: 'Allergies', answers: ['Peanuts'] },
        { question: 'Favourite Cuisines', answers: ['Italian', 'Mediterranean'] },
        { question: 'Favourite Dishes', answers: ['Truffle Risotto', 'Grilled Sea Bass'] },
        { question: 'Alcohol', answers: ['No'] },
        { question: 'Favourite Drinks', answers: [] },
        { question: 'Favourite Cocktail', answers: [] },
      ],
    },
    'm-parveen': {
      minglerId: 'm-parveen',
      fullName: 'Parveen Rizvi',
      isProMingler: false,
      proMinglerKind: 'NONE',
      minglerSince: '22 Mar 2025',
      accountStatus: 'ACTIVE',
      eatingPreferences: [
        { question: 'Culinary Restrictions', answers: ['Vegetarian'] },
        // A question the seven-question set never had — proves the renderer iterates
        // whatever the admin catalogue currently holds instead of naming questions.
        { question: 'Spice Tolerance', answers: ['Medium'] },
      ],
    },
    'm-quiet': {
      // Every question unanswered → every row reads "Not specified".
      minglerId: 'm-quiet',
      fullName: 'Laiba Naseer',
      isProMingler: false,
      proMinglerKind: 'NONE',
      minglerSince: '01 Feb 2026',
      accountStatus: 'SUSPENDED',
      eatingPreferences: [
        { question: 'Culinary Restrictions', answers: [] },
        { question: 'Allergies', answers: [] },
      ],
    },
    'm-osama': {
      minglerId: 'm-osama',
      fullName: 'Osama Hashmi',
      isProMingler: true,
      proMinglerKind: 'SELF_CLAIMED',
      minglerSince: '15 Sep 2024',
      accountStatus: 'ACTIVE',
      eatingPreferences: [],
    },
    // The three Minglers who appear only on the Finances ledger. Endpoint 9 is the
    // one profile read for the whole portal — Interest Tables, Reviews and Finances
    // all open this modal — so every name that is clickable anywhere resolves here.
    'm-danish': {
      minglerId: 'm-danish',
      fullName: 'Danish Ahmed',
      isProMingler: false,
      proMinglerKind: 'NONE',
      minglerSince: '04 Jul 2025',
      accountStatus: 'ACTIVE',
      eatingPreferences: [
        { question: 'Culinary Restrictions', answers: [] },
        { question: 'Allergies', answers: ['Shellfish'] },
        { question: 'Favourite Cuisines', answers: ['Japanese'] },
        { question: 'Alcohol', answers: ['Yes'] },
        { question: 'Favourite Drinks', answers: ['Sake'] },
      ],
    },
    'm-nadia': {
      minglerId: 'm-nadia',
      fullName: 'Nadia Rahman',
      isProMingler: false,
      proMinglerKind: 'NONE',
      minglerSince: '18 Nov 2024',
      accountStatus: 'ACTIVE',
      eatingPreferences: [
        { question: 'Culinary Restrictions', answers: ['Halal Only'] },
        { question: 'Favourite Dishes', answers: ['Mansaf'] },
      ],
    },
    'm-yusuf': {
      minglerId: 'm-yusuf',
      fullName: 'Yusuf Ali',
      isProMingler: true,
      proMinglerKind: 'ADMIN_ASSIGNED',
      minglerSince: '02 Feb 2023',
      accountStatus: 'ACTIVE',
      eatingPreferences: [
        { question: 'Favourite Cuisines', answers: ['Levantine', 'Turkish'] },
        { question: 'Alcohol', answers: ['No'] },
      ],
    },
  }
}

let tables: MockTable[] = seedTables()
let menuOptions: Record<string, InterestTableMenuOption[]> = seedMenuOptions()
let bookings: Record<string, InterestTableBookingRow[]> = seedBookings()
let invitees: Record<string, InviteeRow[]> = seedInvitees()
let minglers: Record<string, MinglerProfile> = seedMinglers()

export function resetMockInterestTables(): void {
  tables = seedTables()
  menuOptions = seedMenuOptions()
  bookings = seedBookings()
  invitees = seedInvitees()
  minglers = seedMinglers()
}

/** Only non-Draft tables are ever addressable (BR-03). */
function liveTable(itId: string): MockTable | undefined {
  return tables.find((table) => table.interestTableId === itId && !table.isDraft)
}

function findBooking(bookingId: string): InterestTableBookingRow | undefined {
  return Object.values(bookings)
    .flat()
    .find((booking) => booking.bookingId === bookingId)
}

export function mockInterestTableBooking(bookingId: string): InterestTableBookingRow | undefined {
  const found = findBooking(bookingId)
  return found ? { ...found } : undefined
}

export function mockInvitee(inviteeId: string): InviteeRow | undefined {
  const found = Object.values(invitees)
    .flat()
    .find((invitee) => invitee.inviteeId === inviteeId)
  return found ? { ...found } : undefined
}

export function mockLiveInterestTableCount(): number {
  return tables.filter((table) => !table.isDraft).length
}

/** Empties the grid, for the empty-state case. */
export function clearMockInterestTables(): void {
  tables = []
}

/**
 * Cancellation is ACTIVE-only (BR-07) — note this is stricter than J6A's
 * `editable`, which also allows DRAFT and REJECTED.
 */
function requireActive(): Response | null {
  return mockProfile.status === 'ACTIVE'
    ? null
    : errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: mockProfile.status })
}

// ── Endpoint 1: the grid ───────────────────────────────────────
export function listMockInterestTables(url: URL): Response {
  const status = url.searchParams.get('status')
  const page = Number(url.searchParams.get('page') ?? '1')
  const pageSize = Number(url.searchParams.get('pageSize') ?? '10')

  // Draft is filtered server-side, so the client never has to.
  let visible = tables.filter((table) => !table.isDraft)
  if (status) visible = visible.filter((table) => table.status === status)

  const start = (page - 1) * pageSize
  const items: InterestTableListItem[] = visible.slice(start, start + pageSize).map((table) => ({
    interestTableId: table.interestTableId,
    name: table.name,
    imageUrl: table.imageUrl,
    date: table.startDate,
    time: table.startTime,
    maxGuests: table.maxGuests,
    availabilityMode: table.availabilityMode,
    inviteOnly: table.inviteOnly,
    seatsBooked: table.seatsBooked,
    proMingler: table.proMingler,
    status: table.status,
  }))

  return HttpResponse.json({
    success: true,
    data: { items, page, pageSize, total: visible.length },
  })
}

// ── Endpoint 2: Overview ───────────────────────────────────────
export function getMockInterestTable(itId: string): Response {
  const table = liveTable(itId)
  if (!table) return errorResponse('ERR_NOT_FOUND', IT_NOT_FOUND, 404)

  const { isDraft: _isDraft, imageUrl: _imageUrl, seatsBooked: _seatsBooked, ...detail } = table
  void _isDraft
  void _imageUrl
  void _seatsBooked
  return HttpResponse.json({ success: true, data: detail })
}

// ── Endpoint 3: Menu Options ───────────────────────────────────
export function listMockInterestTableMenuOptions(itId: string): Response {
  if (!liveTable(itId)) return errorResponse('ERR_NOT_FOUND', IT_NOT_FOUND, 404)
  return HttpResponse.json({ success: true, data: { items: menuOptions[itId] ?? [] } })
}

// ── Endpoint 4: Bookings ───────────────────────────────────────
export function listMockInterestTableBookings(itId: string): Response {
  if (!liveTable(itId)) return errorResponse('ERR_NOT_FOUND', IT_NOT_FOUND, 404)
  return HttpResponse.json({ success: true, data: { items: bookings[itId] ?? [] } })
}

// ── Endpoint 5: Booking Details ────────────────────────────────
export function getMockBooking(bookingId: string): Response {
  const booking = findBooking(bookingId)
  if (!booking) return errorResponse('ERR_NOT_FOUND', BOOKING_NOT_FOUND, 404)

  const itId = Object.keys(bookings).find((key) =>
    bookings[key].some((row) => row.bookingId === bookingId),
  )
  const table = itId ? liveTable(itId) : undefined
  if (!table) return errorResponse('ERR_NOT_FOUND', BOOKING_NOT_FOUND, 404)

  // Topic and Time are the two fields the list row omits — the whole reason this
  // endpoint exists. No restaurant field, by design.
  const detail: BookingDetail = {
    bookingId: booking.bookingId,
    bookingRef: booking.bookingRef,
    minglerName: booking.minglerName,
    interestTableName: table.name,
    topic: table.topic,
    menuOption: booking.menuOption,
    date: booking.date,
    time: table.startTime,
    status: booking.status,
    billPkr: booking.billPkr,
  }
  return HttpResponse.json({ success: true, data: detail })
}

// ── Endpoint 6: Cancel Booking ─────────────────────────────────
export function cancelMockBooking(bookingId: string): Response {
  const refused = requireActive()
  if (refused) return refused

  const booking = findBooking(bookingId)
  if (!booking) return errorResponse('ERR_NOT_FOUND', BOOKING_NOT_FOUND, 404)

  // Checked before the terminal-state guard: a Promingler booking is refused for
  // being a Promingler booking whatever state it is in.
  if (booking.proMingler.isProMingler) {
    return errorResponse(
      'ERR_PROMINGLER_BOOKING_NOT_CANCELLABLE',
      "Promingler bookings can't be cancelled here.",
      409,
    )
  }

  if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') {
    return errorResponse(
      'ERR_BOOKING_NOT_CANCELLABLE',
      'This booking can no longer be cancelled.',
      409,
      { status: booking.status },
    )
  }

  booking.status = 'CANCELLED'
  booking.cancellable = false
  booking.billPkr = null

  // The seat count moves too, which is why the client invalidates the detail read
  // alongside the bookings list.
  const itId = Object.keys(bookings).find((key) =>
    bookings[key].some((row) => row.bookingId === bookingId),
  )
  const table = itId ? liveTable(itId) : undefined
  if (table && table.seatsBooked > 0) {
    table.seatsBooked -= 1
    table.seatsLeft += 1
  }

  return HttpResponse.json({ success: true, data: { bookingId, status: 'CANCELLED' } })
}

// ── Endpoint 7: Invitees ───────────────────────────────────────
export function listMockInvitees(itId: string): Response {
  const table = liveTable(itId)
  if (!table) return errorResponse('ERR_NOT_FOUND', IT_NOT_FOUND, 404)

  // A non-Invite-Only table answers false with nothing in it — the client hides the
  // tab rather than rendering an empty state.
  if (!table.inviteOnly) {
    return HttpResponse.json({ success: true, data: { inviteOnly: false, items: [] } })
  }
  return HttpResponse.json({
    success: true,
    data: { inviteOnly: true, items: invitees[itId] ?? [] },
  })
}

// ── Endpoint 8: Cancel Invite ──────────────────────────────────
export function cancelMockInvite(itId: string, inviteeId: string): Response {
  const refused = requireActive()
  if (refused) return refused

  const table = liveTable(itId)
  if (!table) return errorResponse('ERR_NOT_FOUND', INVITE_NOT_FOUND, 404)

  const invitee = (invitees[itId] ?? []).find((row) => row.inviteeId === inviteeId)
  if (!invitee) return errorResponse('ERR_NOT_FOUND', INVITE_NOT_FOUND, 404)

  if (invitee.inviteStatus !== 'INVITED') {
    return errorResponse(
      'ERR_INVITE_NOT_CANCELLABLE',
      'This invite can no longer be cancelled.',
      409,
      { inviteStatus: invitee.inviteStatus },
    )
  }

  invitee.inviteStatus = 'CANCELLED'
  invitee.cancellable = false
  return HttpResponse.json({ success: true, data: { inviteeId, inviteStatus: 'CANCELLED' } })
}

// ── Endpoint 9: Mingler profile ────────────────────────────────
export function getMockMingler(minglerId: string): Response {
  const mingler = minglers[minglerId]
  // Unreachable from this restaurant → 404. Expected, not a bug.
  if (!mingler) return errorResponse('ERR_NOT_FOUND', PROFILE_UNAVAILABLE, 404)
  return HttpResponse.json({ success: true, data: mingler })
}

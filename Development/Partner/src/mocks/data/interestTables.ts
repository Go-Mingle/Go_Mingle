// ── Interest Tables ──────────────────────────────────────
// Admin-created tables minglers book against. Consume an Interest Topic
// and a restaurant's combos.
export type InterestTableStatus =
  | 'draft'
  | 'coming_soon'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'

export interface InterestTableMedia {
  url: string
  type: 'image' | 'video'
  caption: string
}

export interface InterestTable {
  id: string
  /** Interest table's own name (distinct from its topic). */
  name: string
  topicId: string
  topicName: string
  description: string
  restaurantId: string
  restaurantName: string
  thumbnail: string
  media: InterestTableMedia[]
  comboIds: string[]
  /** Single mingler count (3–6); the table confirms when reached. */
  minglerCount: number
  /** Assigned restaurant table. */
  tableId: string
  tableName: string
  startDate: string
  startTime: string
  durationHours: number
  // V8 SA6 (optional; populated as UI workstreams land)
  mode?: 'available_now' | 'coming_soon'
  inviteOnly?: boolean
  inviteList?: string[]
  inviteDates?: Record<string, string>
  promingler?: { id: string; name: string; email: string }
  selfCaptain?: { id: string; name: string; email: string }
  minGuests?: number
  maxGuests?: number
  coverImage?: string
  /** @deprecated V8 replaces sponsorship with Promingler / Self Captain mode. */
  sponsored?: boolean
  /** @deprecated */
  sponsorName?: string
  /** @deprecated */
  sponsorLogo?: string
  status: InterestTableStatus
  confirmedCount: number
  createdDate: string
  /** ISO timestamp when the booking window closes (drives the "time left" countdown). */
  expiresAt: string
}

const TABLE_IMG_A = 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&q=80'
const TABLE_IMG_B = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&q=80'
const TABLE_IMG_C = 'https://images.unsplash.com/photo-1559339352-11d035aa65de?w=600&q=80'

// Booking-window deadline relative to load time so the countdown stays live in the demo.
const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString()

const IT_MEDIA: InterestTableMedia[] = []

// Concise demo interest table for Aurelia (rest1) — used to fill out the list
// so the Interest Tables tab paginates and shows status variety.
const auTable = (
  id: string,
  name: string,
  topicId: string,
  topicName: string,
  status: InterestTableStatus,
  mode: 'available_now' | 'coming_soon',
  startDate: string,
  startTime: string,
  confirmedCount: number,
  maxGuests: number,
  thumbnail: string,
): InterestTable => ({
  id,
  name,
  topicId,
  topicName,
  description: 'A demo interest table at Aurelia showcasing status and availability variety.',
  restaurantId: 'rest1',
  restaurantName: 'Aurelia',
  thumbnail,
  media: IT_MEDIA,
  comboIds: ['combo1', 'combo2'],
  minglerCount: 6,
  tableId: 'tbl1',
  tableName: 'Window Table',
  startDate,
  startTime,
  durationHours: 2,
  mode,
  inviteOnly: false,
  minGuests: 4,
  maxGuests,
  status,
  confirmedCount,
  createdDate: '2026-06-12',
  expiresAt: hoursFromNow(200),
})

export const mockInterestTables: InterestTable[] = [
  {
    id: 'it1',
    name: 'Friday Wine Evening',
    topicId: 't1',
    topicName: 'Wine & Dine',
    description:
      'An evening pairing fine wines with curated small plates, for guests who enjoy relaxed conversation over good food.',
    restaurantId: 'rest1',
    restaurantName: 'Aurelia',
    thumbnail: TABLE_IMG_A,
    media: IT_MEDIA,
    comboIds: ['combo1', 'combo2'],
    minglerCount: 6,
    tableId: 'tbl1',
    tableName: 'Window Table',
    startDate: '2026-06-20',
    startTime: '7:00 PM',
    durationHours: 2,
    mode: 'available_now',
    inviteOnly: false,
    minGuests: 4,
    maxGuests: 6,
    // Self Captain mode: a booked Mingler claimed the crown (no admin verify).
    selfCaptain: { id: 'm1', name: 'Sana Khan', email: 'sana.khan@gmail.com' },
    status: 'confirmed',
    confirmedCount: 6,
    createdDate: '2026-04-20',
    expiresAt: hoursFromNow(52),
  },
  {
    id: 'it2',
    name: 'Founders Dinner',
    topicId: 't2',
    topicName: 'Startup Founders',
    description:
      'A table for early-stage founders to swap notes on building, fundraising, and the realities of running a company.',
    restaurantId: 'rest3',
    restaurantName: 'Coral & Lime',
    thumbnail: TABLE_IMG_C,
    media: IT_MEDIA,
    comboIds: ['combo3'],
    minglerCount: 4,
    tableId: 'tbl3',
    tableName: "Chef's Counter",
    startDate: '2026-06-18',
    startTime: '8:00 PM',
    durationHours: 1.5,
    mode: 'available_now',
    inviteOnly: false,
    minGuests: 4,
    maxGuests: 4,
    promingler: { id: 'm1', name: 'Sana Khan', email: 'sana.khan@gmail.com' },
    status: 'pending',
    confirmedCount: 2,
    createdDate: '2026-04-28',
    expiresAt: hoursFromNow(5),
  },
  {
    id: 'it3',
    name: 'Monthly Book Night',
    topicId: 't3',
    topicName: 'Book Club',
    description:
      'Readers gather to discuss a chosen title over dinner. Each session focuses on one book agreed in advance.',
    restaurantId: 'rest5',
    restaurantName: 'Yuzu',
    thumbnail: TABLE_IMG_B,
    media: IT_MEDIA,
    comboIds: ['combo4', 'combo5'],
    minglerCount: 5,
    tableId: 'tbl2',
    tableName: 'Garden Patio',
    startDate: '2026-06-10',
    startTime: '6:00 PM',
    durationHours: 2,
    sponsored: false,
    status: 'completed',
    confirmedCount: 5,
    createdDate: '2026-03-15',
    expiresAt: hoursFromNow(-48),
  },
  {
    id: 'it4',
    name: 'AI Builders Meetup',
    topicId: 't4',
    topicName: 'Tech & AI',
    description:
      'Conversations on the latest in technology and artificial intelligence, open to enthusiasts and professionals alike.',
    restaurantId: 'rest2',
    restaurantName: 'Saffron Table',
    thumbnail: TABLE_IMG_A,
    media: IT_MEDIA,
    comboIds: ['combo1', 'combo3', 'combo5'],
    minglerCount: 5,
    tableId: 'tbl1',
    tableName: 'Window Table',
    startDate: '2026-06-22',
    startTime: '7:30 PM',
    durationHours: 2,
    sponsored: true,
    sponsorName: 'AI Labs',
    sponsorLogo: 'https://picsum.photos/seed/ailabs/80/80',
    status: 'pending',
    confirmedCount: 3,
    createdDate: '2026-05-02',
    expiresAt: hoursFromNow(26),
  },
  {
    id: 'it5',
    name: 'Foodie Social',
    topicId: 't5',
    topicName: 'Foodies Unite',
    description:
      'For people who plan trips around restaurants. Share recommendations and discover hidden culinary gems together.',
    restaurantId: 'rest6',
    restaurantName: 'Olive & Ash',
    thumbnail: TABLE_IMG_C,
    media: IT_MEDIA,
    comboIds: ['combo2'],
    minglerCount: 4,
    tableId: 'tbl4',
    tableName: 'Private Booth',
    startDate: '2026-06-12',
    startTime: '12:00 PM',
    durationHours: 3,
    sponsored: false,
    status: 'cancelled',
    confirmedCount: 0,
    createdDate: '2026-03-30',
    expiresAt: hoursFromNow(-72),
  },
  {
    id: 'it6',
    name: 'Wine & Cheese Night',
    topicId: 't1',
    topicName: 'Wine & Dine',
    description:
      'An evening pairing fine wines with curated small plates, for guests who enjoy relaxed conversation over good food.',
    restaurantId: 'rest7',
    restaurantName: 'Smoke + Sugar',
    thumbnail: TABLE_IMG_B,
    media: IT_MEDIA,
    comboIds: ['combo1', 'combo4'],
    minglerCount: 4,
    tableId: 'tbl2',
    tableName: 'Garden Patio',
    startDate: '2026-06-15',
    startTime: '8:00 PM',
    durationHours: 2,
    sponsored: false,
    status: 'confirmed',
    confirmedCount: 4,
    createdDate: '2026-04-10',
    expiresAt: hoursFromNow(8),
  },
  {
    id: 'it7',
    name: 'Startup Mixer',
    topicId: 't2',
    topicName: 'Startup Founders',
    description:
      'A table for early-stage founders to swap notes on building, fundraising, and the realities of running a company.',
    restaurantId: 'rest1',
    restaurantName: 'Aurelia',
    thumbnail: TABLE_IMG_A,
    media: IT_MEDIA,
    comboIds: ['combo2', 'combo5'],
    minglerCount: 6,
    tableId: 'tbl1',
    tableName: 'Window Table',
    startDate: '2026-06-25',
    startTime: '7:00 PM',
    durationHours: 2.5,
    mode: 'available_now',
    inviteOnly: false,
    minGuests: 4,
    maxGuests: 6,
    status: 'pending',
    confirmedCount: 5,
    createdDate: '2026-05-05',
    expiresAt: hoursFromNow(70),
  },
  {
    id: 'it8',
    name: 'Supper Club',
    topicId: 't5',
    topicName: 'Foodies Unite',
    description:
      'Draft table not yet published — visible only in the admin portal until the admin publishes it.',
    restaurantId: 'rest1',
    restaurantName: 'Aurelia',
    thumbnail: TABLE_IMG_B,
    media: IT_MEDIA,
    comboIds: ['combo1'],
    minglerCount: 0,
    tableId: 'tbl2',
    tableName: 'Garden Patio',
    startDate: '2026-07-02',
    startTime: '7:30 PM',
    durationHours: 2,
    mode: 'available_now',
    inviteOnly: false,
    minGuests: 4,
    maxGuests: 5,
    status: 'draft',
    confirmedCount: 0,
    createdDate: '2026-05-20',
    expiresAt: hoursFromNow(120),
  },
  {
    id: 'it9',
    name: 'Omakase Preview',
    topicId: 't3',
    topicName: 'Book Club',
    description:
      'Coming Soon, invite-only preview evening. Visible in the app but not yet bookable until transitioned to Available Now.',
    restaurantId: 'rest5',
    restaurantName: 'Yuzu',
    thumbnail: TABLE_IMG_A,
    media: IT_MEDIA,
    comboIds: ['combo4'],
    minglerCount: 0,
    tableId: 'tbl1',
    tableName: 'Window Table',
    startDate: '2026-07-05',
    startTime: '6:30 PM',
    durationHours: 2,
    mode: 'coming_soon',
    inviteOnly: true,
    inviteList: ['m1', 'm2'],
    minGuests: 4,
    maxGuests: 8,
    status: 'coming_soon',
    confirmedCount: 0,
    createdDate: '2026-05-22',
    expiresAt: hoursFromNow(140),
  },
  {
    id: 'it10',
    name: "Chef's Table Supper",
    topicId: 't1',
    topicName: 'Wine & Dine',
    description:
      'A hosted evening led by a designated Pro Mingler, pairing a tasting menu with easy conversation.',
    restaurantId: 'rest1',
    restaurantName: 'Aurelia',
    thumbnail: TABLE_IMG_C,
    media: IT_MEDIA,
    comboIds: ['combo1', 'combo2'],
    minglerCount: 6,
    tableId: 'tbl1',
    tableName: 'Window Table',
    startDate: '2026-07-10',
    startTime: '7:30 PM',
    durationHours: 2.5,
    mode: 'available_now',
    inviteOnly: true,
    minGuests: 4,
    maxGuests: 6,
    // Admin-designated Pro Mingler hosts this table.
    promingler: { id: 'm3', name: 'Parveen Rizvi', email: 'parveen.r@gmail.com' },
    // Invited minglers: some have booked (m1, m2), the rest are still just invited.
    inviteList: ['m1', 'm2', 'm4', 'm6', 'm5', 'm7', 'm10'],
    inviteDates: {
      m3: '2026-05-25',
      m1: '2026-05-26',
      m2: '2026-05-26',
      m4: '2026-05-28',
      m6: '2026-05-29',
      m5: '2026-06-01',
      m7: '2026-06-03',
      m10: '2026-06-05',
    },
    status: 'confirmed',
    confirmedCount: 6,
    createdDate: '2026-05-25',
    expiresAt: hoursFromNow(160),
  },
  {
    id: 'it11',
    name: 'Private Tasting',
    topicId: 't5',
    topicName: 'Foodies Unite',
    description:
      'An invite-only tasting evening. Only Minglers on the invite list can see and book this table.',
    restaurantId: 'rest1',
    restaurantName: 'Aurelia',
    thumbnail: TABLE_IMG_B,
    media: IT_MEDIA,
    comboIds: ['combo2'],
    minglerCount: 5,
    tableId: 'tbl2',
    tableName: 'Garden Patio',
    startDate: '2026-07-12',
    startTime: '8:00 PM',
    durationHours: 2,
    mode: 'available_now',
    inviteOnly: true,
    inviteList: ['m1', 'm2', 'm4'],
    minGuests: 4,
    maxGuests: 5,
    status: 'pending',
    confirmedCount: 3,
    createdDate: '2026-05-27',
    expiresAt: hoursFromNow(180),
  },
  {
    id: 'it12',
    name: 'Rooftop Sundowners',
    topicId: 't1',
    topicName: 'Wine & Dine',
    description:
      'A Coming Soon rooftop evening — visible in the app but not yet bookable until the admin makes it available.',
    restaurantId: 'rest1',
    restaurantName: 'Aurelia',
    thumbnail: TABLE_IMG_A,
    media: IT_MEDIA,
    comboIds: ['combo1', 'combo2'],
    minglerCount: 6,
    tableId: 'tbl1',
    tableName: 'Window Table',
    startDate: '2026-07-18',
    startTime: '6:30 PM',
    durationHours: 2,
    mode: 'coming_soon',
    inviteOnly: false,
    minGuests: 4,
    maxGuests: 6,
    status: 'coming_soon',
    confirmedCount: 0,
    createdDate: '2026-06-08',
    expiresAt: hoursFromNow(320),
  },
  {
    id: 'it13',
    name: 'Supper Club Vol. 2',
    topicId: 't5',
    topicName: 'Foodies Unite',
    description:
      'A Coming Soon, invite-only supper preview. Invited Minglers can be managed before it opens for booking.',
    restaurantId: 'rest1',
    restaurantName: 'Aurelia',
    thumbnail: TABLE_IMG_B,
    media: IT_MEDIA,
    comboIds: ['combo2'],
    minglerCount: 5,
    tableId: 'tbl2',
    tableName: 'Garden Patio',
    startDate: '2026-07-22',
    startTime: '8:00 PM',
    durationHours: 2,
    mode: 'coming_soon',
    inviteOnly: true,
    inviteList: ['m1', 'm4'],
    inviteDates: { m1: '2026-06-09', m4: '2026-06-10' },
    minGuests: 4,
    maxGuests: 5,
    status: 'coming_soon',
    confirmedCount: 0,
    createdDate: '2026-06-09',
    expiresAt: hoursFromNow(360),
  },
  // ── Additional demo tables for Aurelia (pagination + status variety) ──
  auTable(
    'it14',
    'Tapas & Talks',
    't2',
    'Startup Founders',
    'confirmed',
    'available_now',
    '2026-07-24',
    '7:00 PM',
    6,
    6,
    TABLE_IMG_C,
  ),
  auTable(
    'it15',
    'Sunset Book Club',
    't3',
    'Book Club',
    'pending',
    'available_now',
    '2026-07-26',
    '6:00 PM',
    3,
    6,
    TABLE_IMG_B,
  ),
  auTable(
    'it16',
    'Mezze Mondays',
    't1',
    'Wine & Dine',
    'coming_soon',
    'coming_soon',
    '2026-08-03',
    '7:30 PM',
    0,
    6,
    TABLE_IMG_A,
  ),
  auTable(
    'it17',
    'Founders Brunch',
    't2',
    'Startup Founders',
    'completed',
    'available_now',
    '2026-06-01',
    '11:00 AM',
    6,
    6,
    TABLE_IMG_C,
  ),
  auTable(
    'it18',
    'Late Night Ramen',
    't5',
    'Foodies Unite',
    'cancelled',
    'available_now',
    '2026-06-14',
    '9:00 PM',
    0,
    6,
    TABLE_IMG_B,
  ),
  auTable(
    'it19',
    'Tech Over Tapas',
    't4',
    'Tech & AI',
    'draft',
    'available_now',
    '2026-08-10',
    '7:00 PM',
    0,
    6,
    TABLE_IMG_A,
  ),
  auTable(
    'it20',
    'Wine Down Wednesday',
    't1',
    'Wine & Dine',
    'confirmed',
    'available_now',
    '2026-07-29',
    '8:00 PM',
    5,
    6,
    TABLE_IMG_C,
  ),
]

/**
 * Read-only availability slots declared by restaurant partners (V8 SA6 AC6).
 * Surfaced via GET /api/restaurants/:id/available-slots.
 */
export interface MockAvailableSlot {
  id: string
  restaurantId: string
  day: string
  startTime: string
  endTime: string
}

export const mockAvailableSlots: MockAvailableSlot[] = [
  { id: 'slot1', restaurantId: 'rest1', day: 'Friday', startTime: '6:00 PM', endTime: '10:00 PM' },
  {
    id: 'slot2',
    restaurantId: 'rest1',
    day: 'Saturday',
    startTime: '5:00 PM',
    endTime: '11:00 PM',
  },
  {
    id: 'slot3',
    restaurantId: 'rest3',
    day: 'Thursday',
    startTime: '7:00 PM',
    endTime: '10:00 PM',
  },
  { id: 'slot4', restaurantId: 'rest5', day: 'Sunday', startTime: '12:00 PM', endTime: '4:00 PM' },
  { id: 'slot5', restaurantId: 'rest5', day: 'Friday', startTime: '6:30 PM', endTime: '10:30 PM' },
]

/**
 * Interest table lifecycle + booking statuses.
 *
 * V8 (SA6) adds two lifecycle states ahead of the booking states:
 *  - `draft`        — created/saved by admin, visible only in the portal.
 *  - `coming_soon`  — published but not yet bookable; auto-cancels at the
 *                     2-hour mark if not transitioned to Available Now.
 *
 * The remaining states (`pending`/`confirmed`/`completed`/`cancelled`) are
 * shared with Mingler booking rows, as in the existing data model.
 */
export type InterestTableStatus =
  | 'draft'
  | 'coming_soon'
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'

/** Availability mode chosen at create/publish time (V8 SA6 AC40). */
export type AvailabilityMode = 'available_now' | 'coming_soon'

/**
 * Promingler designation type. Both show the crown 👑; an admin-designated
 * Promingler additionally shows a verified check ✓. A Mingler who claims the
 * Promingler role on the table itself shows the crown only. The two are
 * mutually exclusive per table (V8 SA6 AC11 / SA8 AC5).
 */
export type ProminglerType = 'admin_verified' | 'self_crown'

/** Reference to the Mingler designated as the table's Promingler. */
export interface ProminglerRef {
  id: string
  name: string
  email: string
}

export interface InterestTableMedia {
  url: string
  type: 'image' | 'video'
  caption: string
}

export interface InterestTable {
  id: string
  name: string
  topicId: string
  topicName: string
  description: string
  restaurantId: string
  restaurantName: string
  thumbnail: string
  media: InterestTableMedia[]
  comboIds: string[]
  minglerCount: number
  tableId: string
  tableName: string
  startDate: string
  startTime: string
  durationHours: number

  // --- V8 SA6 fields (additive; populated as the UI workstreams land) ---
  /** Availability mode — controls bookability at publish. */
  mode?: AvailabilityMode
  /** Invite-only tables are visible only to invited Minglers; one-way after publish. */
  inviteOnly?: boolean
  /** Mingler ids invited to an invite-only table. */
  inviteList?: string[]
  /** Date (ISO) each invited Mingler was invited, keyed by mingler id. */
  inviteDates?: Record<string, string>
  /** Admin-designated Promingler for this table; Self Captain mode when undefined. */
  promingler?: ProminglerRef
  /**
   * Self-claimed Pro Mingler (crown, not admin-verified) in Self Captain mode.
   * Present when a booked Mingler has taken the captain role but no admin
   * Promingler was assigned. Undefined = nobody has claimed it yet.
   */
  selfCaptain?: ProminglerRef
  /** Platform-fixed minimum guest count (4); read-only in the UI. */
  minGuests?: number
  /** Admin-selected maximum guest count (one of 4–8). */
  maxGuests?: number
  /** Cover image; falls back to the restaurant main photo when empty. */
  coverImage?: string

  /** @deprecated V8 SA6 replaces sponsorship with Promingler / Self Captain mode. Removed in the Create/Edit form workstream. */
  sponsored?: boolean
  /** @deprecated see `sponsored`. */
  sponsorName?: string
  /** @deprecated see `sponsored`. */
  sponsorLogo?: string

  status: InterestTableStatus
  confirmedCount: number
  createdDate: string
  expiresAt: string
}

export interface InterestTableBooking {
  [key: string]: unknown
  id: string
  bookingId: string
  minglerId?: string
  guest: string
  date: string
  interestTableId: string
  interestTableTopic: string
  comboId: string
  comboName: string
  status: InterestTableStatus
  bill: number
  /**
   * True for a Promingler booking (crown 👑). Auto-created at publish for
   * admin-designated Prominglers; no charge and no loyalty points.
   */
  isPromingler?: boolean
  /** True when the Promingler was admin-designated — adds the verified check ✓. */
  prominglerVerified?: boolean
  /**
   * Legacy crown flag. Retained for existing rows/components; equivalent to a
   * self-claimed Promingler (crown only). Reconciled with `isPromingler` in the
   * detail/bookings UI workstream.
   */
  isCaptain?: boolean
}

export interface CreateInterestTableDto {
  name: string
  topicId: string
  topicName: string
  description: string
  restaurantId: string
  restaurantName: string
  thumbnail: string
  media: InterestTableMedia[]
  comboIds: string[]
  minglerCount: number
  tableId: string
  tableName: string
  startDate: string
  startTime: string
  durationHours: number

  // --- V8 SA6 (optional until the Create/Edit form workstream wires them) ---
  mode?: AvailabilityMode
  inviteOnly?: boolean
  inviteList?: string[]
  /** Mingler id of the Promingler to assign; Self Captain mode when omitted. */
  prominglerId?: string
  maxGuests?: number
  coverImage?: string
  /** When true the table is saved in `draft` status instead of published. */
  saveAsDraft?: boolean

  /** @deprecated see InterestTable.sponsored. */
  sponsored?: boolean
  /** @deprecated */
  sponsorName?: string
  /** @deprecated */
  sponsorLogo?: string
}

/** A read-only availability slot declared by the restaurant partner (V8 SA6 AC6). */
export interface AvailableSlot {
  id: string
  restaurantId: string
  /** Day of week, e.g. "Friday". */
  day: string
  startTime: string
  endTime: string
}

/** Payload for the Change Promingler flow (V8 SA6 AC14). */
export interface ChangeProminglerDto {
  prominglerId: string
}

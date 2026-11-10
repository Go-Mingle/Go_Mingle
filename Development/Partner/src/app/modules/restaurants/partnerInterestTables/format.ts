import { formatPkr } from '../../finances/financesFormat'
import type { StatusVariant } from '../../../atoms/StatusBadge'
import type {
  BookingStatus,
  EatingPreference,
  InterestTableStatus,
  InviteStatus,
  ProminglerKind,
} from './types'

/**
 * Display helpers for the Interest Tables surface.
 *
 * The load-bearing rule here is that **dates and times arrive pre-formatted** —
 * `28-04-2026` and `7:00 PM`, already converted to Asia/Karachi by the server — and
 * are rendered exactly as received.
 *
 * This is deliberately not a `dayjs` pass-through. The rest of the portal writes
 * `dayjs(value).format('DD-MM-YYYY')`, which assumes an ISO input: given
 * `"28-04-2026"` it produces **`Invalid Date`**, because dayjs reads the leading
 * `28` as a month. Reparsing would also risk a timezone shift moving a booking to
 * the wrong day. Same convention as `financesFormat.formatLedgerDate`.
 *
 * Note this is `DD-MM-YYYY` while J5 Finances and J6A's decline date are
 * `YYYY-MM-DD` — the portal genuinely shows two shapes. MET-1250 fixed only the
 * J6A surface it was raised against; picking one platform-wide convention is
 * still an open cross-module decision, and this helper is one of the sites it
 * would land on.
 */

const EM_DASH = '—'

/** A pre-formatted `DD-MM-YYYY` date, or an em dash when absent. */
export function displayDate(value: string | null | undefined): string {
  return value?.trim() || EM_DASH
}

/** A pre-formatted `h:mm A` time, or an em dash when absent. */
export function displayTime(value: string | null | undefined): string {
  return value?.trim() || EM_DASH
}

/**
 * `PKR 1,840` for a charged booking, an em dash for an uncharged one.
 *
 * Null is the uncharged case and must not read as `PKR 0` — a booking with no
 * bill yet is not a free booking. Reuses J5's `formatPkr` so money reads the same
 * across the portal.
 */
export function displayBill(billPkr: number | null | undefined): string {
  return typeof billPkr === 'number' && Number.isFinite(billPkr) ? formatPkr(billPkr) : EM_DASH
}

/** `120` → `2h`, `90` → `1h 30m`, `45` → `45m`. */
export function displayDuration(minutes: number | null | undefined): string {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return EM_DASH

  const whole = Math.floor(minutes)
  const hours = Math.floor(whole / 60)
  const rest = whole % 60
  if (hours === 0) return `${String(rest)}m`
  if (rest === 0) return `${String(hours)}h`
  return `${String(hours)}h ${String(rest)}m`
}

/**
 * The Promingler indicator (BR-10).
 *
 * `ADMIN_ASSIGNED` gets the verified tick **and** the crown; `SELF_CLAIMED` the
 * crown alone; `NONE` renders nothing. Maps straight onto the shared
 * `ProminglerBadge`'s single `verified` prop rather than re-deriving the
 * distinction from a handful of overlapping booleans, as the prototype did.
 */
export function prominglerBadge(kind: ProminglerKind | null | undefined): {
  show: boolean
  verified: boolean
} {
  return {
    show: kind === 'ADMIN_ASSIGNED' || kind === 'SELF_CLAIMED',
    verified: kind === 'ADMIN_ASSIGNED',
  }
}

/**
 * Availability mode as a readable label.
 *
 * The wire value is an admin-owned enum whose members are not pinned by the spec,
 * so anything unrecognised is title-cased rather than dropped — showing
 * `Available Now` for a value we know and `Some New Mode` for one we do not beats
 * showing an em dash for a mode that exists.
 */
export function displayAvailabilityMode(mode: string | null | undefined): string {
  const raw = mode?.trim()
  if (!raw) return EM_DASH

  return raw
    .toLowerCase()
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Interest-table status → `StatusBadge` variant.
 *
 * `COMING_SOON` and `CONFIRMED` are variants this change adds to the shared badge;
 * before J6F the only components rendering them were prototype forks with
 * off-token hex colours.
 */
const IT_STATUS_VARIANTS: Record<InterestTableStatus, StatusVariant> = {
  PENDING: 'pending',
  COMING_SOON: 'coming-soon',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export function interestTableStatusVariant(status: InterestTableStatus): StatusVariant {
  return IT_STATUS_VARIANTS[status] ?? 'pending'
}

const BOOKING_STATUS_VARIANTS: Record<BookingStatus, StatusVariant> = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export function bookingStatusVariant(status: BookingStatus): StatusVariant {
  return BOOKING_STATUS_VARIANTS[status] ?? 'pending'
}

const INVITE_STATUS_VARIANTS: Record<InviteStatus, StatusVariant> = {
  INVITED: 'invited',
  TABLE_BOOKED: 'table-booked',
  CANCELLED: 'cancelled',
}

export function inviteStatusVariant(status: InviteStatus): StatusVariant {
  return INVITE_STATUS_VARIANTS[status] ?? 'invited'
}

/**
 * The account-status pill on the Mingler modal.
 *
 * The wire value is J11's enum, so it is normalised loosely: a value the shared
 * badge knows renders as itself, anything else falls back to `active` rather than
 * crashing on an unknown variant.
 */
const MINGLER_STATUS_VARIANTS: Record<string, StatusVariant> = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  DEACTIVATED: 'deactivated',
  PENDING: 'pending',
}

export function minglerStatusVariant(status: string | null | undefined): StatusVariant {
  return MINGLER_STATUS_VARIANTS[status?.trim().toUpperCase() ?? ''] ?? 'active'
}

/**
 * One eating-preference row's answers.
 *
 * Returns null when the question is unanswered, so the caller renders its own
 * "Not specified" copy through i18n rather than having an English string baked in
 * here. The server sends `answers: []` for unanswered — making that readable is
 * the client's job.
 */
export function preferenceAnswers(preference: EatingPreference): string | null {
  const answers = preference.answers.map((answer) => answer.trim()).filter(Boolean)
  return answers.length > 0 ? answers.join(', ') : null
}

/** `5` of `8` seats → `5 / 8`. Used by the grid's seats column. */
export function displaySeats(booked: number, max: number): string {
  return `${String(booked)} / ${String(max)}`
}

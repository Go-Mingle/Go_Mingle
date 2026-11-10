import { doublePrecision, integer, pgTable, serial, text } from 'drizzle-orm/pg-core'

/**
 * A Mingler's seats at an interest table.
 *
 * status      PENDING | CONFIRMED → COMPLETED, or CANCELLED
 * attendance  set when the dinner is checked in:
 *             ARRIVED (everyone came) · PARTIAL (some seats empty) · NO_SHOW (nobody came)
 *
 * The no-show policy is copied from the restaurant when the booking is made,
 * so a later policy change never touches existing bookings (GM-204).
 */
export const bookings = pgTable('bookings', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  bookingRef: text('booking_ref').notNull(),
  interestTableId: text('interest_table_id').notNull(),
  restaurantId: text('restaurant_id').notNull(),
  /** Null until the Mingler app creates bookings for real accounts. */
  minglerId: text('mingler_id'),
  minglerName: text('mingler_name').notNull(),
  seats: integer('seats').notNull(),
  menuOption: text('menu_option').notNull().default(''),
  status: text('status').notNull(),
  attendance: text('attendance'),
  arrivedSeats: integer('arrived_seats'),
  emptySeats: integer('empty_seats'),
  penaltyPerSeatPkr: doublePrecision('penalty_per_seat_pkr').notNull(),
  cancellationWindowHours: integer('cancellation_window_hours').notNull(),
  /** What was charged for empty seats; null while nothing is due. */
  penaltyChargedPkr: doublePrecision('penalty_charged_pkr'),
  /** CHARGED | FAILED (see payment_failures) | null */
  penaltyStatus: text('penalty_status'),
  /** The card hold for the penalty; null when the policy was zero. */
  escrowHoldId: text('escrow_hold_id'),
  /** Who checked the booking in: a staff member's name, or the automatic no-show check. */
  checkedInBy: text('checked_in_by'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

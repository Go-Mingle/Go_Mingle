import { boolean, integer, jsonb, pgTable, primaryKey, serial, text } from 'drizzle-orm/pg-core'

/**
 * Interest tables: themed dinners GoMingle sets up at a restaurant.
 * Created and managed in the Admin Panel; the restaurant sees them read-only.
 *
 * status: DRAFT → (publish) PENDING | COMING_SOON → CONFIRMED → COMPLETED, or CANCELLED.
 * `topic` and `assignedTable` are kept as they were named when chosen.
 */
export const interestTables = pgTable('interest_tables', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  restaurantId: text('restaurant_id').notNull(),
  name: text('name'),
  topic: jsonb('topic').$type<{ id: string; name: string; graphicUrl: string | null } | null>(),
  assignedTable: jsonb('assigned_table').$type<{ id: string; name: string } | null>(),
  seatsBooked: integer('seats_booked').notNull().default(0),
  maxGuests: integer('max_guests'),
  /** YYYY-MM-DD */
  startDate: text('start_date'),
  /** HH:MM, 24-hour */
  startTime: text('start_time'),
  durationMinutes: integer('duration_minutes'),
  /** Menu options (combos) of the restaurant offered at this table. */
  comboIds: jsonb('combo_ids').$type<string[]>().notNull().default([]),
  inviteList: jsonb('invite_list').$type<unknown[]>().notNull().default([]),
  eventImageUrl: text('event_image_url'),
  /** AVAILABLE_NOW | COMING_SOON */
  availabilityMode: text('availability_mode'),
  inviteOnly: boolean('invite_only').notNull().default(false),
  prominglerEnabled: boolean('promingler_enabled').notNull().default(false),
  prominglerMinglerId: text('promingler_mingler_id'),
  timeLeft: text('time_left').notNull(),
  status: text('status').notNull(),
  /** ISO timestamp */
  created: text('created').notNull(),
})

/** Minglers GoMingle invited to an interest table. */
export const interestTableInvitees = pgTable(
  'interest_table_invitees',
  {
    interestTableId: text('interest_table_id').notNull(),
    minglerId: text('mingler_id').notNull(),
    seq: serial('seq').notNull(),
    fullName: text('full_name').notNull(),
    isPromingler: boolean('is_promingler').notNull().default(false),
    dateInvited: text('date_invited').notNull(),
    /** INVITED | TABLE_BOOKED | CANCELLED */
    status: text('status').notNull().default('INVITED'),
  },
  (t) => [primaryKey({ columns: [t.interestTableId, t.minglerId] })],
)

import { customType, doublePrecision, integer, jsonb, pgTable, serial, text } from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

/** Restaurant categories: each sets the platform commission for its restaurants. */
export const categories = pgTable('categories', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  commissionRate: doublePrecision('commission_rate'),
  interestTablesPerMonth: integer('interest_tables_per_month'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
})

/** Amenities partners tick on their profile. `iconUrl`: a data URL, an http URL, or a Phosphor icon name. */
export const amenities = pgTable('amenities', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  iconUrl: text('icon_url'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

/** Interests Minglers choose, in groups. */
export const interests = pgTable('interests', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  groupName: text('group_name'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at'),
})

export interface InterestSnapshot {
  id: string
  name: string
  groupName: string | null
  createdAt: string
  updatedAt: string | null
}

/** Interest-table topics. `interests` holds the interests as they were when linked. */
export const topics = pgTable('topics', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  graphicUrl: text('graphic_url'),
  interests: jsonb('interests').$type<InterestSnapshot[]>().notNull().default([]),
  createdAt: text('created_at').notNull(),
})

/** Mingler onboarding questions. */
export const preferenceQuestions = pgTable('preference_questions', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  question: text('question').notNull(),
  type: text('type'),
  questionOrder: integer('question_order').notNull(),
  createdAt: text('created_at').notNull(),
})

export const preferenceOptions = pgTable('preference_options', {
  id: text('id').notNull(),
  questionId: text('question_id').notNull(),
  position: integer('position').notNull(),
  text: text('text').notNull(),
  displayOrder: integer('display_order').notNull(),
})

/** Platform settings stored as one JSON value per key (loyalty configuration…). */
export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<Record<string, unknown>>().notNull(),
})

/** Files uploaded through signed URLs (topic graphics, interest-table covers). */
export const bucketObjects = pgTable('bucket_objects', {
  key: text('key').primaryKey(),
  bytes: bytea('bytes').notNull(),
  contentType: text('content_type').notNull(),
})

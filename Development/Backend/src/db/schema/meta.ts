import { pgTable, text } from 'drizzle-orm/pg-core'

/** Install-level flags (which first-run steps have run). */
export const meta = pgTable('meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
})

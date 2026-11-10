import { pgTable, serial, text } from 'drizzle-orm/pg-core'

/** Change log: one audit row for every change an admin makes in the Admin Panel. Append-only. */
export const changeLogs = pgTable('change_logs', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  /** 'YYYY-MM-DD HH:mm' Karachi time */
  timestamp: text('timestamp').notNull(),
  admin: text('admin').notNull(),
  initials: text('initials').notNull(),
  /** create | update | delete */
  action: text('action').notNull(),
  data: text('data').notNull(),
  oldVal: text('old_val'),
  newVal: text('new_val').notNull(),
  module: text('module').notNull(),
})

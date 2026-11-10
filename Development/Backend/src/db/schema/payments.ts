import { pgTable, text } from 'drizzle-orm/pg-core'

/** The bank account GoMingle releases a restaurant's escrow into. */
export const payoutAccounts = pgTable('payout_accounts', {
  restaurantId: text('restaurant_id').primaryKey(),
  accountTitle: text('account_title').notNull(),
  bankName: text('bank_name').notNull(),
  /** Normalised (no spaces, upper case). Only ever shown masked. */
  iban: text('iban').notNull(),
  addedAt: text('added_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

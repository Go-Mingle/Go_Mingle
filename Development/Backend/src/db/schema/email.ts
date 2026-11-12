import { boolean, index, pgTable, serial, text } from 'drizzle-orm/pg-core'

/**
 * Email templates the admin edits under Configure → Email Templates. One row
 * per template key; the defaults live in code (`shared/email/catalog.ts`) and
 * a missing row is created from them on first read.
 */
export const emailTemplates = pgTable('email_templates', {
  key: text('key').primaryKey(),
  subject: text('subject').notNull(),
  heading: text('heading').notNull(),
  /** Plain text; a blank line starts a new paragraph, `{{name}}` inserts a value. */
  body: text('body').notNull(),
  /** Empty: the email has no button. */
  buttonLabel: text('button_label').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  updatedAt: text('updated_at'),
  updatedBy: text('updated_by'),
})

/** Every email the API tried to send, newest last. */
export const emailLog = pgTable(
  'email_log',
  {
    id: serial('id').primaryKey(),
    templateKey: text('template_key').notNull(),
    toEmail: text('to_email').notNull(),
    subject: text('subject').notNull(),
    /** SENT | FAILED | LOGGED (no provider configured) | SKIPPED (template switched off) */
    status: text('status').notNull(),
    provider: text('provider').notNull(),
    providerMessageId: text('provider_message_id'),
    error: text('error'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('email_log_created').on(t.createdAt)],
)

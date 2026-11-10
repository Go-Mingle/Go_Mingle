import { bigint, boolean, integer, pgTable, serial, text } from 'drizzle-orm/pg-core'

/**
 * A restaurant's webhook endpoint (Integrations screen).
 * TODO(go-live, GM-248): keep bearerToken and signingSecret in the secrets store, not in this table.
 */
export const webhookConfigs = pgTable('webhook_configs', {
  restaurantId: text('restaurant_id').primaryKey(),
  endpointUrl: text('endpoint_url'),
  bearerToken: text('bearer_token'),
  signingSecret: text('signing_secret'),
  enabled: boolean('enabled').notNull().default(false),
  secretRotatedAt: text('secret_rotated_at'),
})

/** Delivery log of a restaurant's webhook. */
export const webhookDeliveries = pgTable('webhook_deliveries', {
  seq: serial('seq').primaryKey(),
  restaurantId: text('restaurant_id').notNull(),
  eventType: text('event_type').notNull(),
  tries: integer('tries').notNull().default(1),
  reason: text('reason'),
  occurredAt: text('occurred_at').notNull(),
  /** DELIVERED | RETRYING | FAILED | FAILED_EMAILED */
  status: text('status').notNull(),
  isTest: boolean('is_test').notNull().default(false),
  /** A test delivery shows in the log a few seconds after it is sent (ms). */
  visibleFrom: bigint('visible_from', { mode: 'number' }).notNull().default(0),
})

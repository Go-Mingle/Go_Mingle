import type { WebhookEventType, DeliveryStatus, DeliveryRowStatus } from './types'

/** Delivery mode per event type (PP9 AC9). Only IT Published is GATING. */
export type DeliveryMode = 'gating' | 'standard'

export interface WebhookEventDef {
  type: WebhookEventType
  /** Short event name shown in the stream (e.g. "Published"). */
  nameKey: string
  mode: DeliveryMode
  /** Sample JSON payload shown when the event row is expanded. */
  sample: Record<string, unknown>
}

export interface WebhookStream {
  /** Stream label key (e.g. "Interest table"). */
  labelKey: string
  /** Ordering hint shown as a code chip (e.g. "ordered per interestTableId"). */
  orderKey: string
  events: WebhookEventDef[]
}

/** The two ordered streams and their events, in delivery order (PP9 AC9). */
export const WEBHOOK_STREAMS: WebhookStream[] = [
  {
    labelKey: 'streams.interestTable',
    orderKey: 'streams.orderedIt',
    events: [
      {
        type: 'INTEREST_TABLE_PUBLISHED',
        nameKey: 'events.published',
        mode: 'gating',
        sample: {
          eventType: 'INTEREST_TABLE_PUBLISHED',
          idempotencyKey: '01J9X4A7QK',
          interestTableId: 'a3f1c2',
          restaurantId: 'r_88b2',
          payload: {
            title: 'Sunday Roast Social',
            status: 'PUBLISHED',
            seatsTotal: 6,
            seatsBooked: 0,
            startsAt: '2026-08-02T18:00:00Z',
            tableId: 't_204',
            tableName: 'Window 4',
          },
        },
      },
      {
        type: 'INTEREST_TABLE_UPDATED',
        nameKey: 'events.updated',
        mode: 'standard',
        sample: {
          eventType: 'INTEREST_TABLE_UPDATED',
          idempotencyKey: '01J9X5B2WM',
          interestTableId: 'a3f1c2',
          restaurantId: 'r_88b2',
          payload: {
            title: 'Sunday Roast Social',
            status: 'PUBLISHED',
            seatsTotal: 8,
            startsAt: '2026-08-02T18:30:00Z',
          },
        },
      },
      {
        type: 'INTEREST_TABLE_CANCELLED',
        nameKey: 'events.cancelled',
        mode: 'standard',
        sample: {
          eventType: 'INTEREST_TABLE_CANCELLED',
          idempotencyKey: '01J9X6C9TZ',
          interestTableId: 'a3f1c2',
          restaurantId: 'r_88b2',
          payload: {
            status: 'CANCELLED',
            cancelledAt: '2026-07-30T09:12:00Z',
            reason: 'CANCELLED_BY_RESTAURANT',
          },
        },
      },
    ],
  },
  {
    labelKey: 'streams.booking',
    orderKey: 'streams.orderedBk',
    events: [
      {
        type: 'BOOKING_CREATED',
        nameKey: 'events.created',
        mode: 'standard',
        sample: {
          eventType: 'BOOKING_CREATED',
          idempotencyKey: '01J9Y1D4KP',
          bookingId: 'b_5521',
          restaurantId: 'r_88b2',
          payload: {
            status: 'CREATED',
            interestTableId: 'a3f1c2',
            tableId: 't_204',
            tableName: 'Window 4',
            partySize: 2,
            minglerName: 'A. Rahman',
            startsAt: '2026-08-02T18:30:00Z',
          },
        },
      },
      {
        type: 'BOOKING_CONFIRMED',
        nameKey: 'events.confirmed',
        mode: 'standard',
        sample: {
          eventType: 'BOOKING_CONFIRMED',
          idempotencyKey: '01J9Y2E8LR',
          bookingId: 'b_5521',
          restaurantId: 'r_88b2',
          payload: {
            status: 'CONFIRMED',
            tableId: 't_204',
            partySize: 2,
            confirmedAt: '2026-08-01T10:00:00Z',
          },
        },
      },
      {
        type: 'BOOKING_COMPLETED',
        nameKey: 'events.completed',
        mode: 'standard',
        sample: {
          eventType: 'BOOKING_COMPLETED',
          idempotencyKey: '01J9Y3F1MN',
          bookingId: 'b_5521',
          restaurantId: 'r_88b2',
          payload: {
            status: 'COMPLETED',
            tableId: 't_204',
            completedAt: '2026-08-02T21:15:00Z',
          },
        },
      },
      {
        type: 'BOOKING_CANCELLED',
        nameKey: 'events.cancelledBk',
        mode: 'standard',
        sample: {
          eventType: 'BOOKING_CANCELLED',
          idempotencyKey: '01J9Y4G6PQ',
          bookingId: 'b_5521',
          restaurantId: 'r_88b2',
          payload: {
            status: 'CANCELLED',
            tableId: 't_204',
            cancelledAt: '2026-08-01T14:22:00Z',
            reason: 'MINGLER_CANCELLED',
          },
        },
      },
    ],
  },
]

/** Flat lookup of every event def by type — for the test dropdown and log labels. */
export const WEBHOOK_EVENTS: WebhookEventDef[] = WEBHOOK_STREAMS.flatMap((s) => s.events)

/** Human label ("Booking · Created") for an event type, via i18n keys. */
export function eventLabelKeys(type: WebhookEventType): { streamKey: string; nameKey: string } {
  for (const stream of WEBHOOK_STREAMS) {
    const ev = stream.events.find((e) => e.type === type)
    if (ev) return { streamKey: stream.labelKey, nameKey: ev.nameKey }
  }
  return { streamKey: 'streams.booking', nameKey: 'events.created' }
}

/**
 * Solid status colour per delivery status — matches the interest-table status
 * badges (solid fill + white text).
 *
 * Both terminal states share the error colour but keep separate labels: only
 * `FAILED_EMAILED` may claim the payload was emailed.
 */
export const DELIVERY_STATUS_STYLE: Record<DeliveryStatus, { solid: string; labelKey: string }> = {
  DELIVERED: { solid: 'var(--color-success)', labelKey: 'deliveries.delivered' },
  RETRYING: { solid: 'var(--color-warning)', labelKey: 'deliveries.retrying' },
  FAILED_EMAILED: { solid: 'var(--color-error)', labelKey: 'deliveries.failedEmailed' },
  FAILED: { solid: 'var(--color-error)', labelKey: 'deliveries.failed' },
}

/**
 * MET-1277 — the four server statuses plus the client's own `QUEUED` marker for
 * a test that has been accepted but not yet recorded.
 *
 * Deliberately neutral grey. Green would claim a delivery nobody has confirmed
 * and red would report a failure that has not happened; the whole point of the
 * marker is that the outcome is not known yet.
 */
export const DELIVERY_ROW_STATUS_STYLE: Record<
  DeliveryRowStatus,
  { solid: string; labelKey: string }
> = {
  ...DELIVERY_STATUS_STYLE,
  QUEUED: { solid: 'var(--color-text-muted)', labelKey: 'deliveries.queued' },
}

/**
 * Rows have no id, so build a stable key from the fields that identify an
 * attempt. Index is included because two attempts of the same event can share a
 * timestamp to the second.
 */
export function deliveryRowKey(
  delivery: { eventType: string; occurredAt: string; tries: number },
  // AntD's GetRowKey passes this as optional, so it has to be tolerated here.
  index?: number,
): string {
  return `${delivery.occurredAt}-${delivery.eventType}-${delivery.tries}-${index ?? 0}`
}

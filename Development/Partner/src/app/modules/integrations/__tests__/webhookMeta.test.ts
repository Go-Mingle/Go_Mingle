import { describe, it, expect } from 'vitest'
import {
  DELIVERY_STATUS_STYLE,
  WEBHOOK_EVENTS,
  deliveryRowKey,
  eventLabelKeys,
} from '../webhookMeta'
import type { DeliveryStatus, WebhookEventType } from '../types'

describe('webhookMeta', () => {
  it('exposes all seven event types (BR-09)', () => {
    expect(WEBHOOK_EVENTS).toHaveLength(7)
  })

  /**
   * The partner-facing name is CANCELLED, not F2's internal DELETED — it has to
   * match in the catalogue, the test dropdown and the delivery log.
   */
  it('names the interest-table third event CANCELLED', () => {
    const types = WEBHOOK_EVENTS.map((e) => e.type)
    expect(types).toContain('INTEREST_TABLE_CANCELLED')
    expect(types).not.toContain('INTEREST_TABLE_DELETED' as WebhookEventType)
  })

  it('maps an event type to its stream + name i18n keys', () => {
    expect(eventLabelKeys('INTEREST_TABLE_PUBLISHED')).toEqual({
      streamKey: 'streams.interestTable',
      nameKey: 'events.published',
    })
    expect(eventLabelKeys('BOOKING_CREATED')).toEqual({
      streamKey: 'streams.booking',
      nameKey: 'events.created',
    })
  })

  it('falls back for an unknown event type rather than throwing', () => {
    expect(eventLabelKeys('NOPE' as WebhookEventType)).toEqual({
      streamKey: 'streams.booking',
      nameKey: 'events.created',
    })
  })

  it('only the interest-table Published event is gating', () => {
    const gating = WEBHOOK_EVENTS.filter((e) => e.mode === 'gating')
    expect(gating).toHaveLength(1)
    expect(gating[0].type).toBe('INTEREST_TABLE_PUBLISHED')
  })
})

describe('DELIVERY_STATUS_STYLE', () => {
  it('covers all four statuses, not three', () => {
    expect(Object.keys(DELIVERY_STATUS_STYLE).sort()).toEqual([
      'DELIVERED',
      'FAILED',
      'FAILED_EMAILED',
      'RETRYING',
    ])
  })

  /** Only the emailed variant may claim an email was sent. */
  it('keeps the two terminal states on separate labels', () => {
    expect(DELIVERY_STATUS_STYLE.FAILED_EMAILED.labelKey).toBe('deliveries.failedEmailed')
    expect(DELIVERY_STATUS_STYLE.FAILED.labelKey).toBe('deliveries.failed')
  })

  it('shares the error colour across both terminal states', () => {
    expect(DELIVERY_STATUS_STYLE.FAILED.solid).toBe(DELIVERY_STATUS_STYLE.FAILED_EMAILED.solid)
  })
})

describe('deliveryRowKey', () => {
  const row = { eventType: 'BOOKING_CREATED', occurredAt: '2026-08-04T09:00:00.000Z', tries: 1 }

  it('builds a key from the fields that identify an attempt', () => {
    expect(deliveryRowKey(row, 0)).toBe('2026-08-04T09:00:00.000Z-BOOKING_CREATED-1-0')
  })

  it('distinguishes two attempts that share a timestamp', () => {
    expect(deliveryRowKey(row, 0)).not.toBe(deliveryRowKey(row, 1))
  })

  it('tolerates the optional index AntD may omit', () => {
    expect(deliveryRowKey(row)).toContain('-0')
  })
})

describe('status typing', () => {
  it('accepts every status the API can return', () => {
    const all: DeliveryStatus[] = ['DELIVERED', 'RETRYING', 'FAILED_EMAILED', 'FAILED']
    all.forEach((status) => expect(DELIVERY_STATUS_STYLE[status]).toBeDefined())
  })
})

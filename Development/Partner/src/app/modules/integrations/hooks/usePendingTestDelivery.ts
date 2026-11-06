import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TEST_DELIVERY_CLOCK_SKEW_MS, TEST_DELIVERY_CONFIRM_WINDOW_MS } from '../constants'
import { eventLabelKeys } from '../webhookMeta'
import type { WebhookDeliveriesPage, WebhookDeliveryRow, WebhookEventType } from '../types'

/**
 * MET-1277 — the gap between "accepted" and "recorded".
 *
 * `POST /partner/webhook/test` answers 202 and returns. The delivery record is
 * written by the F2 worker afterwards, so for a stretch after the toast the log
 * legitimately has nothing in it. Before this, the UI fired one invalidation on
 * the 202 and then went quiet, which meant the refetch almost always landed
 * ahead of the worker and the partner was left staring at an unchanged log with
 * no pending state to explain it — the ticket's exact report.
 *
 * So the send is tracked until the server's own row for it shows up:
 *
 * - `pendingRow` is a local marker, shown as a `QUEUED` row at the top of the
 *   log. It is not a delivery and never claims to be one.
 * - the log is polled while the send is outstanding.
 * - once a matching server row arrives the marker is dropped, so the real
 *   record — with the real status, tries and reason — takes its place.
 * - if the window closes with nothing, the marker says so rather than vanishing
 *   or quietly turning green. Whether the record ever lands is F2's question to
 *   answer; what the UI can honestly say is that it stopped waiting.
 *
 * This is deliberately two hooks. The poll flag has to be settled *before*
 * `useWebhooks` runs, while the row can only be derived from what that query
 * returned — one hook taking the page as an argument would be a render behind,
 * and the poll would never start.
 */
export interface PendingTestDelivery {
  eventType: WebhookEventType
  /** Browser clock at the moment the 202 landed. */
  sentAt: number
  /** True once the confirmation window has closed with no matching row. */
  unconfirmed: boolean
}

/** Does this server row look like the test we are waiting on? */
function matchesPendingTest(
  row: { isTest: boolean; eventType: WebhookEventType; occurredAt: string },
  pending: PendingTestDelivery,
): boolean {
  if (!row.isTest || row.eventType !== pending.eventType) return false
  const occurred = new Date(row.occurredAt).getTime()
  if (Number.isNaN(occurred)) return false
  // Anything older than the send (beyond clock skew) is a previous test, not
  // this one — matching it would clear the marker on someone else's row.
  return occurred >= pending.sentAt - TEST_DELIVERY_CLOCK_SKEW_MS
}

/** Tracks the outstanding send. Call this before the deliveries query. */
export function usePendingTestDelivery() {
  const [pending, setPending] = useState<PendingTestDelivery | null>(null)

  const startPendingTest = useCallback((eventType: WebhookEventType) => {
    setPending({ eventType, sentAt: Date.now(), unconfirmed: false })
  }, [])

  const clearPendingTest = useCallback(() => {
    setPending(null)
  }, [])

  // Close the window. Measured from `sentAt` rather than from now, so a remount
  // mid-wait does not restart the clock.
  useEffect(() => {
    if (!pending || pending.unconfirmed) return
    const remaining = TEST_DELIVERY_CONFIRM_WINDOW_MS - (Date.now() - pending.sentAt)
    const timer = setTimeout(
      () => setPending((current) => (current ? { ...current, unconfirmed: true } : current)),
      Math.max(0, remaining),
    )
    return () => clearTimeout(timer)
  }, [pending])

  return {
    pending,
    /**
     * Poll the log while this is true. It ignores whether the row has already
     * arrived — the effect in {@link usePendingDeliveryRow} clears `pending` in
     * that case, which costs at most one extra tick and keeps this flag free of
     * any dependency on the query it controls.
     */
    pollDeliveries: pending !== null && !pending.unconfirmed,
    startPendingTest,
    clearPendingTest,
  }
}

/** Derives the marker row from the outstanding send. Call this after the query. */
export function usePendingDeliveryRow(
  pending: PendingTestDelivery | null,
  deliveriesPage: WebhookDeliveriesPage | undefined,
  onRecorded: () => void,
) {
  const { t } = useTranslation('integrations')

  /**
   * Whether the server's own record is already on screen. Derived rather than
   * read from state so the marker disappears in the same render that shows the
   * real row — clearing it only from the effect below would leave both visible
   * for a frame.
   */
  const recorded =
    !!pending && !!deliveriesPage && deliveriesPage.items.some((r) => matchesPendingTest(r, pending))

  useEffect(() => {
    if (recorded) onRecorded()
  }, [recorded, onRecorded])

  const pendingRow = useMemo<WebhookDeliveryRow | null>(() => {
    if (!pending || recorded) return null
    const { streamKey, nameKey } = eventLabelKeys(pending.eventType)
    return {
      eventType: pending.eventType,
      eventLabel: `${t(streamKey)} · ${t(nameKey)}`,
      // No attempt has been reported yet; 1 would be a number we made up.
      tries: 0,
      reason: pending.unconfirmed ? t('deliveries.queuedStale') : null,
      whenRelative: t('deliveries.justNow'),
      occurredAt: new Date(pending.sentAt).toISOString(),
      status: 'QUEUED',
      isTest: true,
      pending: true,
    }
  }, [pending, recorded, t])

  return {
    pendingRow,
    /** A send is outstanding — show the marker and say so on the Events tab. */
    awaitingTestDelivery: pendingRow !== null,
    /** The wait ended with nothing in the log. */
    testDeliveryUnconfirmed: pendingRow !== null && !!pending?.unconfirmed,
  }
}

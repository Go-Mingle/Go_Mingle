import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { usePageVisible } from '../../../../shared/hooks/usePageVisible'
import {
  NOTIFICATION_LIST_QUERY_KEY,
  NOTIFICATION_POLL_MS,
  NOTIFICATION_QUERY_KEY,
  NOTIFICATION_RECENT_QUERY_KEY,
  NOTIFICATION_TYPES_QUERY_KEY,
  NOTIFICATION_UNREAD_QUERY_KEY,
} from '../constants'
import { notificationsService } from '../services'
import type {
  NotificationTypeCatalogue,
  NotificationsPage,
  NotificationsParams,
  RecentNotifications,
  UnreadCount,
} from '../types'

/**
 * J7's server state.
 *
 * Read state is **shared across the restaurant and irreversible**, which shapes the
 * cache handling: there is no un-read mutation, and another user's mark-read only
 * reaches this tab on the next poll. Both writes return the authoritative `unreadCount`,
 * so the badge adopts the server's number rather than trusting arithmetic.
 */

/**
 * The bell badge, polled while the tab is visible (BR-06).
 *
 * `staleTime: 0` deliberately overrides App.tsx's 2-minute default: regaining visibility
 * should produce a fresh read, and a stale-time longer than the poll would swallow it.
 * (App.tsx is a protected file, so this is set per-hook — the same reason
 * `partnerRetryPolicy` exists.)
 *
 * The two refresh paths are both load-bearing and neither subsumes the other (MET-1262):
 * the interval covers a partner sitting on the screen, and the focus refetch covers one
 * returning to a tab whose timer was gated off — that tab would otherwise show a frozen
 * number for a further {@link NOTIFICATION_POLL_MS} while its restarted interval ran down.
 */
export function useUnreadCountQuery() {
  const visible = usePageVisible()

  return useQuery<UnreadCount>({
    queryKey: NOTIFICATION_UNREAD_QUERY_KEY,
    queryFn: notificationsService.getUnreadCount,
    enabled: tokenStore.hasSession(),
    // The function form, as `usePartnerMediaQuery` uses for its video poll. `false`
    // stops the timer outright rather than merely skipping a tick.
    refetchInterval: () => (visible ? NOTIFICATION_POLL_MS : false),
    // React Query's default, pinned rather than inherited: App.tsx owns the client and is
    // a protected file, so a later default there must not be able to switch this off.
    refetchOnWindowFocus: true,
    staleTime: 0,
    ...partnerRetryPolicy,
  })
}

/**
 * The dropdown's seven newest, fetched only once the panel opens.
 *
 * Its response also carries `unreadCount`, which {@link useNotificationsBell} writes into
 * the badge's cache — so opening the panel refreshes the badge without a second request.
 */
export function useRecentNotificationsQuery(enabled: boolean) {
  return useQuery<RecentNotifications>({
    queryKey: NOTIFICATION_RECENT_QUERY_KEY,
    queryFn: notificationsService.getRecent,
    enabled: enabled && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/** The full screen. Params are part of the key so each view caches separately. */
export function useNotificationsQuery(params: NotificationsParams) {
  return useQuery<NotificationsPage>({
    queryKey: [...NOTIFICATION_LIST_QUERY_KEY, params],
    queryFn: () => notificationsService.list(params),
    enabled: tokenStore.hasSession(),
    // Keeps the current page visible while the next one loads, so paging and filtering
    // do not blank the table between reads.
    placeholderData: (previous) => previous,
    ...partnerRetryPolicy,
  })
}

/**
 * The Type filter's options.
 *
 * Static and cacheable, so it is fetched once per session rather than on every filter
 * render — `staleTime: Infinity` is what makes that true.
 */
export function useNotificationTypesQuery() {
  return useQuery<NotificationTypeCatalogue>({
    queryKey: NOTIFICATION_TYPES_QUERY_KEY,
    queryFn: notificationsService.getTypes,
    enabled: tokenStore.hasSession(),
    staleTime: Infinity,
    ...partnerRetryPolicy,
  })
}

/**
 * Writes a known count into the badge cache.
 *
 * Both mutations return the authoritative figure, so the badge is set from the response
 * rather than recomputed — which is also what makes two users' views converge.
 */
function writeUnreadCount(qc: ReturnType<typeof useQueryClient>, unreadCount: number): void {
  qc.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount })
}

/** Re-reads every list and the dropdown, leaving the badge to the value just written. */
function invalidateLists(qc: ReturnType<typeof useQueryClient>): void {
  void qc.invalidateQueries({ queryKey: NOTIFICATION_LIST_QUERY_KEY })
  void qc.invalidateQueries({ queryKey: NOTIFICATION_RECENT_QUERY_KEY })
}

interface CountSnapshot {
  previous?: UnreadCount
}

/**
 * Marks one notification read.
 *
 * Optimistic on the badge and authoritative on settle: `onMutate` decrements so the
 * number moves the instant the row is clicked, then `onSuccess` writes the count the
 * server returned. The decrement alone would drift (another user may have read something
 * since the last poll); the response alone would leave the badge stale for as long as the
 * request takes.
 *
 * The optimistic step is modelled on J6C's amenity toggle — the same snapshot, the same
 * rollback, the same `context as {...}` idiom — with one addition it did not need:
 * `cancelQueries` on the count key. This badge is polled on a timer, so a refetch can
 * already be in flight when the click lands, and it would otherwise resolve *after* the
 * optimistic write and put the old number back.
 */
export function useMarkReadMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => notificationsService.markRead(id),

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATION_UNREAD_QUERY_KEY })
      const previous = qc.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)

      qc.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, (current) =>
        current ? { unreadCount: Math.max(0, current.unreadCount - 1) } : current,
      )

      // Handed to onError as the rollback point.
      return { previous }
    },

    onSuccess: (result) => {
      writeUnreadCount(qc, result.unreadCount)
      invalidateLists(qc)
    },

    onError: (_error, _id, context) => {
      const snapshot = (context as CountSnapshot | undefined)?.previous
      if (snapshot) qc.setQueryData(NOTIFICATION_UNREAD_QUERY_KEY, snapshot)
    },
  })
}

/**
 * Marks every unread notification read (BR-09).
 *
 * Same shape as above, but the optimistic value is zero rather than a decrement — the
 * whole point of the action is that every read affordance disappears at once.
 */
export function useMarkAllReadMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: () => notificationsService.markAllRead(),

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: NOTIFICATION_UNREAD_QUERY_KEY })
      const previous = qc.getQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY)

      qc.setQueryData<UnreadCount>(NOTIFICATION_UNREAD_QUERY_KEY, { unreadCount: 0 })

      return { previous }
    },

    onSuccess: (result) => {
      writeUnreadCount(qc, result.unreadCount)
      invalidateLists(qc)
    },

    onError: (_error, _vars, context) => {
      const snapshot = (context as CountSnapshot | undefined)?.previous
      if (snapshot) qc.setQueryData(NOTIFICATION_UNREAD_QUERY_KEY, snapshot)
    },
  })
}

/**
 * Adopts a count that arrived on a read rather than a write.
 *
 * The dropdown's response carries `unreadCount`, so opening the panel is a free badge
 * refresh — worth taking rather than waiting out the rest of the poll interval.
 */
export function useAdoptUnreadCount() {
  const qc = useQueryClient()
  return (unreadCount: number) => {
    writeUnreadCount(qc, unreadCount)
  }
}

/** Re-reads everything, for when a stale row turns out to be gone. */
export function useRefreshNotifications() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: NOTIFICATION_QUERY_KEY })
  }
}

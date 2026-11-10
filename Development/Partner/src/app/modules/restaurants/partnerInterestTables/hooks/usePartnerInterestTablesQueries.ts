import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import {
  PARTNER_IT_QUERY_KEY,
  partnerBookingKey,
  partnerITBookingsKey,
  partnerITDetailKey,
  partnerITInviteesKey,
  partnerITMenuOptionsKey,
  partnerMinglerKey,
} from '../constants'
import { partnerInterestTablesService as service } from '../services'
import type {
  BookingDetail,
  InterestTableBookingRow,
  InterestTableDetail,
  InterestTableMenuOption,
  InterestTablesPage,
  InterestTablesParams,
  InviteesResponse,
  MinglerProfile,
} from '../types'

/**
 * J6F's server state — seven reads and the two cancellations.
 *
 * Mutations own cache writes only; toasts stay with the caller's `mutate`
 * callbacks, the split the rest of the profile uses.
 *
 * Nothing here is gated on the profile being ACTIVE. Every **read** works in every
 * state including PENDING (BR-07) — the ACTIVE requirement applies only to the two
 * cancel actions, and it is the components that hide those buttons.
 */

/**
 * The grid.
 *
 * `params` is part of the key so each page and filter combination caches
 * separately, and `placeholderData` keeps the previous page on screen while the
 * next loads — otherwise paging or changing the filter blanks the table on every
 * interaction. Same shape as J3's users grid.
 */
export function useInterestTablesQuery(params: InterestTablesParams) {
  return useQuery<InterestTablesPage>({
    queryKey: [...PARTNER_IT_QUERY_KEY, params],
    queryFn: () => service.listInterestTables(params),
    enabled: tokenStore.hasSession(),
    placeholderData: (previous) => previous,
    ...partnerRetryPolicy,
  })
}

export function useInterestTableQuery(itId: string | undefined) {
  const id = itId ?? ''
  return useQuery<InterestTableDetail>({
    queryKey: partnerITDetailKey(id),
    queryFn: () => service.getInterestTable(id),
    enabled: id !== '' && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

export function useInterestTableMenuOptionsQuery(itId: string | undefined) {
  const id = itId ?? ''
  return useQuery<{ items: InterestTableMenuOption[] }>({
    queryKey: partnerITMenuOptionsKey(id),
    queryFn: () => service.listMenuOptions(id),
    enabled: id !== '' && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

export function useInterestTableBookingsQuery(itId: string | undefined) {
  const id = itId ?? ''
  return useQuery<{ items: InterestTableBookingRow[] }>({
    queryKey: partnerITBookingsKey(id),
    queryFn: () => service.listBookings(id),
    enabled: id !== '' && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * The Invited tab's data.
 *
 * Fetched even for a table that turns out not to be Invite Only, because
 * `inviteOnly` is what tells the page whether to render the tab at all — the
 * client cannot know before asking.
 */
export function useInterestTableInviteesQuery(itId: string | undefined) {
  const id = itId ?? ''
  return useQuery<InviteesResponse>({
    queryKey: partnerITInviteesKey(id),
    queryFn: () => service.listInvitees(id),
    enabled: id !== '' && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * The Booking Details popup.
 *
 * Enabled only while a row is selected, so the detail is fetched on click rather
 * than prefetched for every row — the list deliberately omits Topic and Time and
 * this is the call that supplies them.
 */
export function useBookingQuery(bookingId: string | null) {
  const id = bookingId ?? ''
  return useQuery<BookingDetail>({
    queryKey: partnerBookingKey(id),
    queryFn: () => service.getBooking(id),
    enabled: id !== '' && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * The Mingler profile modal.
 *
 * A 404 here is an expected outcome rather than a failure — a partner may only
 * view Minglers with a booking or invite on one of their own tables — so the
 * caller renders "Profile unavailable" instead of an error state. `retry` is left
 * to the shared policy, which does not retry a 404.
 */
export function useMinglerQuery(minglerId: string | null) {
  const id = minglerId ?? ''
  return useQuery<MinglerProfile>({
    queryKey: partnerMinglerKey(id),
    queryFn: () => service.getMingler(id),
    enabled: id !== '' && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * Cancelling a booking moves more than the booking.
 *
 * The server releases the hold or refunds the charge **and decrements the seat
 * count**, so `seatsBooked` on the grid row and `seatsLeft` on the Overview tab
 * both change. Invalidating the whole interest-tables subtree covers the bookings
 * list, the detail and every cached page of the grid in one go; React Query only
 * refetches the queries that are actually mounted, so the breadth costs nothing.
 */
export function useCancelBookingMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (bookingId: string) => service.cancelBooking(bookingId),
    onSuccess: (_data, bookingId) => {
      void qc.invalidateQueries({ queryKey: PARTNER_IT_QUERY_KEY })
      // The popup may still be open on the row just cancelled, and its status is
      // now stale.
      void qc.invalidateQueries({ queryKey: partnerBookingKey(bookingId) })
    },
  })
}

/**
 * Cancelling an invite changes only the invitee row.
 *
 * No seats move — an invite was never a booking — so this deliberately invalidates
 * one table's subtree rather than the whole grid.
 */
export function useCancelInviteMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ itId, inviteeId }: { itId: string; inviteeId: string }) =>
      service.cancelInvite(itId, inviteeId),
    onSuccess: (_data, { itId }) => {
      void qc.invalidateQueries({ queryKey: partnerITDetailKey(itId) })
    },
  })
}

/**
 * "Guests Arrived" completes the table and every open booking on it, so the
 * whole interest-tables subtree is stale: grid status, detail and bookings.
 */
export function useGuestsArrivedMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (itId: string) => service.guestsArrived(itId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: PARTNER_IT_QUERY_KEY })
    },
  })
}

/** A no-show changes the booking and may complete the table. */
export function useMarkNoShowMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ bookingId, emptySeats }: { bookingId: string; emptySeats: number }) =>
      service.markNoShow(bookingId, emptySeats),
    onSuccess: (_data, { bookingId }) => {
      void qc.invalidateQueries({ queryKey: PARTNER_IT_QUERY_KEY })
      void qc.invalidateQueries({ queryKey: partnerBookingKey(bookingId) })
    },
  })
}

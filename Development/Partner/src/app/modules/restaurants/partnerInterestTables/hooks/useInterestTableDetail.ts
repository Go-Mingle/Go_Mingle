import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { usePartnerProfileQuery } from '../../partnerProfile/hooks/usePartnerProfileQueries'
import { IT_TAB_KEYS } from '../constants'
import { isNotFound } from '../errors'
import { useInterestTablesFeedback } from './useInterestTablesFeedback'
import {
  useCancelBookingMutation,
  useCancelInviteMutation,
  useGuestsArrivedMutation,
  useMarkNoShowMutation,
  useInterestTableBookingsQuery,
  useInterestTableInviteesQuery,
  useInterestTableMenuOptionsQuery,
  useInterestTableQuery,
} from './usePartnerInterestTablesQueries'
import type { InterestTableBookingRow, InviteeRow } from '../types'

/**
 * The interest-table detail view (US-02 … US-04).
 *
 * A read-only mirror of the admin detail with exactly two mutations: cancel a
 * booking, and cancel an invite. There is no publish, edit, delete, Change
 * Promingler, or "Make available for booking" — all admin-only (BR-02).
 */
export function useInterestTableDetail(itId: string | undefined, feedback: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])
  const { showSuccess, showInterestTablesError } = useInterestTablesFeedback(feedback)
  const [searchParams, setSearchParams] = useSearchParams()

  const detailQuery = useInterestTableQuery(itId)
  const menuOptionsQuery = useInterestTableMenuOptionsQuery(itId)
  const bookingsQuery = useInterestTableBookingsQuery(itId)
  const inviteesQuery = useInterestTableInviteesQuery(itId)

  const cancelBooking = useCancelBookingMutation()
  const cancelInvite = useCancelInviteMutation()
  const guestsArrived = useGuestsArrivedMutation()
  const markNoShow = useMarkNoShowMutation()

  /**
   * The cancel actions require the restaurant to be **ACTIVE** (BR-07).
   *
   * Deliberately not J6A's `editable`, which is false only while PENDING and so
   * would also permit DRAFT and REJECTED. Read through the shared profile query, so
   * this page costs no extra request when the profile is already cached.
   */
  const profileQuery = usePartnerProfileQuery()
  const canCancel = profileQuery.data?.status === 'ACTIVE'

  const [bookingTarget, setBookingTarget] = useState<InterestTableBookingRow | null>(null)
  const [inviteTarget, setInviteTarget] = useState<InviteeRow | null>(null)
  const [arrivalOpen, setArrivalOpen] = useState(false)
  const [noShowTarget, setNoShowTarget] = useState<InterestTableBookingRow | null>(null)
  const [openBookingId, setOpenBookingId] = useState<string | null>(null)
  const [openMinglerId, setOpenMinglerId] = useState<string | null>(null)

  // The booking detail is fetched by `BookingDetailsModal` itself, from the id below —
  // the same way `MinglerProfileModal` has always worked. It used to be queried here
  // and threaded through as three extra controller fields, which is what stopped the
  // modal being reusable from J6G's Reviews tab.

  // ── Tab state, mirrored into the URL ─────────────────────────
  const activeTab = searchParams.get('tab') ?? IT_TAB_KEYS.overview

  const setActiveTab = useCallback(
    (key: string) => {
      const next = new URLSearchParams(searchParams)
      // Overview is the default, so it stays out of the URL — same convention as
      // the profile page's tab strip.
      if (key === IT_TAB_KEYS.overview) next.delete('tab')
      else next.set('tab', key)
      setSearchParams(next, { replace: true })
    },
    [searchParams, setSearchParams],
  )

  // ── Cancel a booking (US-03) ─────────────────────────────────
  const confirmCancelBooking = useCallback(() => {
    if (!bookingTarget) return

    cancelBooking.mutate(bookingTarget.bookingId, {
      onSuccess: () => {
        showSuccess(t('restaurants:partnerInterestTables.bookingCancelled'))
        setBookingTarget(null)
        // The popup, if open, is showing a status the server just changed.
        setOpenBookingId(null)
      },
      onError: (cause) => {
        showInterestTablesError(cause)
        setBookingTarget(null)
      },
    })
  }, [bookingTarget, cancelBooking, showSuccess, showInterestTablesError, t])

  // ── Guests Arrived ───────────────────────────────────────────
  const confirmGuestsArrived = useCallback(() => {
    if (!itId) return
    guestsArrived.mutate(itId, {
      onSuccess: (result) => {
        showSuccess(t('restaurants:partnerInterestTables.guestsArrivedDone', { count: result.seatsArrived }))
        setArrivalOpen(false)
      },
      onError: (cause) => {
        showInterestTablesError(cause)
        setArrivalOpen(false)
      },
    })
  }, [itId, guestsArrived, showSuccess, showInterestTablesError, t])

  // ── No-show on one booking ───────────────────────────────────
  const confirmNoShow = useCallback(
    (emptySeats: number) => {
      if (!noShowTarget) return
      markNoShow.mutate(
        { bookingId: noShowTarget.bookingId, emptySeats },
        {
          onSuccess: () => {
            showSuccess(t('restaurants:partnerInterestTables.noShowRecorded'))
            setNoShowTarget(null)
          },
          onError: (cause) => {
            showInterestTablesError(cause)
            setNoShowTarget(null)
          },
        },
      )
    },
    [noShowTarget, markNoShow, showSuccess, showInterestTablesError, t],
  )

  // ── Cancel an invite (US-04) ─────────────────────────────────
  const confirmCancelInvite = useCallback(() => {
    if (!inviteTarget || !itId) return

    cancelInvite.mutate(
      { itId, inviteeId: inviteTarget.inviteeId },
      {
        onSuccess: () => {
          showSuccess(t('restaurants:partnerInterestTables.inviteCancelled'))
          setInviteTarget(null)
        },
        onError: (cause) => {
          showInterestTablesError(cause)
          setInviteTarget(null)
        },
      },
    )
  }, [inviteTarget, itId, cancelInvite, showSuccess, showInterestTablesError, t])

  /**
   * A 404 is a **"not found" view**, not an error state.
   *
   * A Draft interest table 404s by design, including through a direct deep link
   * (BR-03), and so does another restaurant's table — the two are indistinguishable
   * on purpose. Neither is a failure worth an alarming error panel.
   */
  const notFound = isNotFound(detailQuery.error)

  return {
    table: detailQuery.data,
    isPending: detailQuery.isPending,
    isError: detailQuery.isError && !notFound,
    error: detailQuery.error,
    notFound,

    activeTab,
    setActiveTab,

    /** Gates both × buttons. ACTIVE-only, unlike the rest of the profile's writes. */
    canCancel,

    menuOptions: menuOptionsQuery.data?.items ?? [],
    menuOptionsPending: menuOptionsQuery.isPending,
    menuOptionsError: menuOptionsQuery.isError,

    bookings: bookingsQuery.data?.items ?? [],
    bookingsPending: bookingsQuery.isPending,
    bookingsError: bookingsQuery.isError,
    bookingsErrorCause: bookingsQuery.error,

    /**
     * Whether to render the Invited tab at all.
     *
     * A non-Invite-Only table answers `inviteOnly: false` with an empty list, and
     * the tab is hidden rather than showing an empty state. Undefined while the
     * read is in flight, so the tab appears once — not flickering in and out.
     */
    inviteOnly: inviteesQuery.data?.inviteOnly ?? false,
    invitees: inviteesQuery.data?.items ?? [],
    inviteesPending: inviteesQuery.isPending,
    inviteesError: inviteesQuery.isError,

    bookingTarget,
    requestCancelBooking: setBookingTarget,
    cancelBookingDialog: () => setBookingTarget(null),
    confirmCancelBooking,
    cancellingBooking: cancelBooking.isPending,

    /**
     * Whether "Guests Arrived" is offered: the server's own flag, plus the same
     * ACTIVE-only gate as the cancel actions.
     */
    canCheckIn: canCancel && detailQuery.data?.canCheckIn === true,
    arrivalOpen,
    requestGuestsArrived: () => setArrivalOpen(true),
    closeGuestsArrived: () => setArrivalOpen(false),
    confirmGuestsArrived,
    checkingIn: guestsArrived.isPending,

    noShowTarget,
    requestNoShow: setNoShowTarget,
    closeNoShow: () => setNoShowTarget(null),
    confirmNoShow,
    markingNoShow: markNoShow.isPending,

    inviteTarget,
    requestCancelInvite: setInviteTarget,
    cancelInviteDialog: () => setInviteTarget(null),
    confirmCancelInvite,
    cancellingInvite: cancelInvite.isPending,

    openBookingId,
    openBooking: setOpenBookingId,
    closeBooking: () => setOpenBookingId(null),

    openMinglerId,
    openMingler: setOpenMinglerId,
    closeMingler: () => setOpenMinglerId(null),
  }
}

export type InterestTableDetailController = ReturnType<typeof useInterestTableDetail>

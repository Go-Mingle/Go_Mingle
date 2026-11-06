import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { FIELD_TO_CARD } from '../constants'
import { isProfileInvalidState, readSubmitBlockers } from '../errors'
import { omitEmpty, toE164 } from '../format'
import { hasCardErrors, mapProfileFieldErrors, validateNameLocation } from '../validation'
import type { CardErrors } from '../validation'
import type { SubmitBlockedDetails, UpdateProfileDto } from '../types'
import {
  useSubmitProfileMutation,
  useUpdateProfileMutation,
  usePartnerProfileQuery,
} from './usePartnerProfileQueries'
import { usePaymentsOnboarding } from './usePaymentsOnboarding'
import type { ProfileFeedback } from './useProfileFeedback'

interface NameLocationForm {
  name: string
  areaDistrict: string
  city: string
}

/**
 * Controller for the profile shell: header affordances, the name/location modal,
 * the payments hand-off, the visibility toggle, and Save as Draft / Send for
 * Approval with their blockers.
 *
 * Editability comes from the server's `editable` flag rather than being derived
 * from status — the server is the authority on what it will accept, and a write
 * refused while PENDING is a 409 either way.
 */
export function useProfilePage({ showSuccess, showError, showErrorText }: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])

  const profileQuery = usePartnerProfileQuery()
  const updateProfile = useUpdateProfileMutation()
  const submitProfile = useSubmitProfileMutation()

  const [nameOpen, setNameOpen] = useState(false)
  const [nameForm, setNameForm] = useState<NameLocationForm>({
    name: '',
    areaDistrict: '',
    city: '',
  })
  const [nameErrors, setNameErrors] = useState<CardErrors>({})
  const [imageOpen, setImageOpen] = useState(false)
  const [paymentsOpen, setPaymentsOpen] = useState(false)
  /**
   * Why the last hand-off did not happen, held in the dialog rather than flashed
   * as a toast (MET-1254). See {@link launchPayments}.
   */
  const [paymentsError, setPaymentsError] = useState<string | null>(null)
  const [blockers, setBlockers] = useState<SubmitBlockedDetails | null>(null)
  /**
   * The server's confirmation message, held open in a dialog rather than flashed
   * as a toast. Submitting no longer navigates anywhere — the partner stays on a
   * page that has just turned read-only — so the acknowledgement has to be
   * something they dismiss, not something that disappears on its own.
   */
  const [submittedMessage, setSubmittedMessage] = useState<string | null>(null)

  const profile = profileQuery.data

  /**
   * Copy for a hand-off that never happened.
   *
   * The backend's own wording wins where it sends any, but the fallback is
   * payments-specific rather than the generic one: the failure QA hit is a bare
   * 502 from the onboarding endpoint, which carries no code to branch on, and
   * "Something went wrong" would leave the partner with nothing to act on.
   */
  const paymentsErrorText = (cause: unknown) =>
    getApiErrorMessage(cause, t('restaurants:profile.errors.paymentSeam'))

  const payments = usePaymentsOnboarding({
    // Returning from Safepay does not itself configure payments — the webhook
    // does — so this only re-reads and lets the UI say "verifying".
    onReturned: () => {
      void profileQuery.refetch()
    },
    // Only reached by the `?payments=refresh` self-heal, which runs with no
    // dialog on screen; the dialog path reports through `launchPayments`.
    onError: (cause: unknown) => showErrorText(paymentsErrorText(cause)),
    // Stops the confirmation poll the moment the webhook has landed.
    paymentConfigured: profile?.paymentConfigured ?? false,
  })

  const openNameModal = () => {
    setNameForm({
      name: profile?.name ?? '',
      areaDistrict: profile?.location.areaDistrict ?? '',
      city: profile?.location.city ?? '',
    })
    setNameErrors({})
    setNameOpen(true)
  }

  const saveNameLocation = () => {
    const found = validateNameLocation(nameForm, t)
    if (hasCardErrors(found)) {
      setNameErrors(found)
      return
    }
    setNameErrors({})

    // Only this card's fields; blanks are omitted rather than sent as null.
    const patch: UpdateProfileDto = { name: nameForm.name.trim() }
    const location = omitEmpty({
      areaDistrict: nameForm.areaDistrict,
      city: nameForm.city,
    })
    if (Object.keys(location).length) patch.location = location

    updateProfile.mutate(patch, {
      onSuccess: () => {
        showSuccess(t('restaurants:profile.saved'))
        setNameOpen(false)
      },
      onError: (cause) => {
        setNameErrors(mapProfileFieldErrors(cause))
        showError(cause)
      },
    })
  }

  /** Accepted only while ACTIVE; turning on without a cover photo is refused. */
  const toggleVisibility = (next: boolean) => {
    updateProfile.mutate(
      { visibleOnApp: next },
      {
        onSuccess: () => {
          showSuccess(
            next ? t('restaurants:profile.visibleOn') : t('restaurants:profile.visibleOff'),
          )
        },
        onError: showError,
      },
    )
  }

  /**
   * `ERR_INVALID_STATE` means the page is stale, not that the partner is wrong —
   * a second tab already submitted, or an admin moved the application on. The
   * honest response is to re-read the truth and let the affordances change, with
   * the message as an explanation rather than a validation complaint.
   */
  const reportStaleOrFail = (cause: unknown) => {
    showError(cause)
    if (isProfileInvalidState(cause)) void profileQuery.refetch()
  }

  const handleSubmit = () => {
    setBlockers(null)
    submitProfile.mutate(undefined, {
      onSuccess: (result) => {
        setSubmittedMessage(result.message)
      },
      onError: (cause) => {
        // All three blockers arrive together; render them all rather than
        // making the partner discover them one submit at a time.
        const found = readSubmitBlockers(cause)
        if (found) setBlockers(found)
        else reportStaleOrFail(cause)
      },
    })
  }

  /**
   * Proceed to Safepay (MET-1254).
   *
   * The dialog used to be dismissed *before* the request was made, so a failed
   * mint read as a success: the dialog vanished, nothing was said, and the
   * partner was never taken anywhere. It now closes only once Safepay has
   * actually been handed the partner, and a failure keeps it open with the
   * reason inline and Proceed still there to retry — the same shape as the
   * Change Password dialog.
   */
  const launchPayments = () => {
    setPaymentsError(null)
    payments.launch({
      onLaunched: () => setPaymentsOpen(false),
      onFailed: (cause) => setPaymentsError(paymentsErrorText(cause)),
    })
  }

  /** Normalises a phone for the wire; display spacing is rejected. */
  const wirePhone = toE164

  return {
    profile,
    isPending: profileQuery.isPending,
    isError: profileQuery.isError,
    error: profileQuery.error,

    status: profile?.status,
    editable: profile?.editable ?? false,
    readiness: profile?.submissionReadiness,
    rejections: profile?.rejections ?? [],

    // Name / location modal
    nameOpen,
    openNameModal,
    closeNameModal: () => setNameOpen(false),
    nameForm,
    // Any edit clears the errors, so a corrected form re-enables Save.
    setNameForm: (next: NameLocationForm) => {
      setNameErrors({})
      setNameForm(next)
    },
    nameErrors,
    nameBlocked: hasCardErrors(nameErrors),
    saveNameLocation,

    // Cover image modal — Replace is disabled until J6B exposes an upload.
    imageOpen,
    openImageModal: () => setImageOpen(true),
    closeImageModal: () => setImageOpen(false),

    // Payments
    paymentsOpen,
    // A stale failure must not greet the next open, or follow the dialog back in.
    openPayments: () => {
      setPaymentsError(null)
      setPaymentsOpen(true)
    },
    closePayments: () => {
      setPaymentsError(null)
      setPaymentsOpen(false)
    },
    launchPayments,
    launchingPayments: payments.launching,
    paymentsError,
    paymentsReturnState: payments.returnState,
    dismissPaymentsReturn: payments.dismissReturnState,
    checkPaymentsAgain: payments.checkAgain,
    checkingPayments: payments.checking,

    // Visibility
    toggleVisibility,

    // Draft / submit
    handleSubmit,
    submitting: submitProfile.isPending,
    submittedMessage,
    dismissSubmitted: () => setSubmittedMessage(null),
    blockers,
    /**
     * Which Overview cards own a reported gap, so each one can say so itself.
     * The banner names the fields; this answers "where do I go" (AC-07.3).
     */
    cardsNeedingAttention: new Set(
      (blockers?.missingFields ?? [])
        .map((field) => FIELD_TO_CARD[field as keyof typeof FIELD_TO_CARD])
        .filter(Boolean),
    ),
    clearBlockers: () => setBlockers(null),

    saving: updateProfile.isPending,
    showError,
    wirePhone,
  }
}

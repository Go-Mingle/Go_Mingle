import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { interestTablesErrorFallbackKey } from '../errors'

/**
 * J6F's error copy, on top of a single toast channel.
 *
 * A separate hook rather than an extra argument on `ProfileFeedback.showError`,
 * because that function is handed straight to React Query as `onError` — which
 * calls it as `onError(error, variables, …)`, so a second parameter would silently
 * be given the mutation variables. Same reasoning as J6B's `useMediaFeedback`,
 * J6D's `useMenuFeedback` and J6E's `useTablesFeedback`.
 *
 * Note on two of the 409s: the backend currently sends a generic "Invalid request"
 * message for `ERR_BOOKING_NOT_CANCELLABLE` and `ERR_INVITE_NOT_CANCELLABLE`, and
 * `getApiErrorMessage` prefers the server's wording — so those two read "Invalid
 * request" until the backend gap is fixed, at which point the correct copy appears
 * with no change here. The fallback keys are already right.
 */
export function useInterestTablesFeedback({ showSuccess, showErrorText }: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])

  const showInterestTablesError = useCallback(
    // Prefers the backend's own wording; falls back on the code, never status.
    (cause: unknown) => {
      showErrorText(getApiErrorMessage(cause, t(interestTablesErrorFallbackKey(cause))))
    },
    [showErrorText, t],
  )

  return { showSuccess, showErrorText, showInterestTablesError }
}

export type InterestTablesFeedback = ReturnType<typeof useInterestTablesFeedback>

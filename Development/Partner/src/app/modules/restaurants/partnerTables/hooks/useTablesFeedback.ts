import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { tablesErrorFallbackKey } from '../errors'

/**
 * J6E's error copy, on top of the page's single toast channel.
 *
 * A separate hook rather than an extra argument on `ProfileFeedback.showError`,
 * because that function is handed straight to React Query as `onError` — which
 * calls it as `onError(error, variables, …)`, so a second parameter would
 * silently be given the mutation variables. Same reasoning as J6B's
 * `useMediaFeedback` and J6D's `useMenuFeedback`.
 */
export function useTablesFeedback({ showSuccess, showErrorText }: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])

  const showTablesError = useCallback(
    // Prefers the backend's own wording; falls back on the code, never status.
    (cause: unknown) => {
      showErrorText(getApiErrorMessage(cause, t(tablesErrorFallbackKey(cause))))
    },
    [showErrorText, t],
  )

  return { showSuccess, showErrorText, showTablesError }
}

export type TablesFeedback = ReturnType<typeof useTablesFeedback>

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { formatBytes } from '../../partnerMedia/format'
import { FileEmptyError, FileTooLargeError } from '../../partnerMedia/hooks/useMediaUpload'
import { menuErrorFallbackKey } from '../errors'

/**
 * J6D's error copy, on top of the page's single toast channel.
 *
 * A separate hook rather than an extra argument on `ProfileFeedback.showError`,
 * because that function is handed straight to React Query as `onError` — which
 * calls it as `onError(error, variables, …)`, so a second parameter would
 * silently be given the mutation variables. Same reasoning as J6B's
 * `useMediaFeedback`.
 */
export function useMenuFeedback({ showSuccess, showErrorText }: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])

  /**
   * The copy for a failed menu call, resolved but not shown.
   *
   * Split out from {@link showMenuError} because the PDF section keeps the last
   * failure on screen as well as toasting it (MET-1258), and both need the same
   * string.
   */
  const menuErrorText = useCallback(
    (cause: unknown): string => {
      // An empty PDF has no signature for the commit to match, so the server
      // calls it a type failure — which is false for someone who did pick a PDF.
      if (cause instanceof FileEmptyError) {
        return t('restaurants:partnerMenu.errors.emptyFile')
      }
      // Raised client-side from the authoritative maxBytes, so the copy is
      // already interpolated and there is no response body to prefer over it.
      if (cause instanceof FileTooLargeError) {
        return t('restaurants:partnerMenu.errors.tooLargeClient', {
          max: formatBytes(cause.details.maxBytes),
        })
      }
      // Prefers the backend's own wording; falls back on the code, never status.
      return getApiErrorMessage(cause, t(menuErrorFallbackKey(cause)))
    },
    [t],
  )

  /** Toasts the failure and hands back what it said, for callers that also keep it. */
  const showMenuError = useCallback(
    (cause: unknown): string => {
      const text = menuErrorText(cause)
      showErrorText(text)
      return text
    },
    [menuErrorText, showErrorText],
  )

  return { showSuccess, showErrorText, showMenuError, menuErrorText }
}

export type MenuFeedback = ReturnType<typeof useMenuFeedback>

import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'
import { mediaErrorFallbackKey } from '../errors'
import { formatBytes } from '../format'
import type { MediaKind } from '../types'
import { FileEmptyError, FileTooLargeError } from './useMediaUpload'

/**
 * J6B's error copy, on top of the page's single toast channel.
 *
 * A separate hook rather than an extra argument on `ProfileFeedback.showError`,
 * because that function is handed straight to React Query as `onError` — which
 * calls it as `onError(error, variables, …)`, so a second parameter would
 * silently be given the mutation variables.
 *
 * It also keeps the kind in the copy: with three limits on one screen, "maximum
 * number of photos" is far more useful than a generic limit message.
 */
export function useMediaFeedback({ showSuccess, showErrorText }: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])

  /**
   * The copy for a failed media call, without showing it.
   *
   * Split out from {@link useMediaFeedback.showMediaError} because an upload
   * failure now needs the same string in two places at once — the page toast and
   * the preview modal's inline notice (MET-1148). Resolving it twice would be
   * two chances to drift.
   */
  const resolveMediaError = useCallback(
    (cause: unknown, kind: MediaKind): string => {
      // Names the real problem. The server would call an empty file a type
      // failure (it has no signature to match), which reads as a lie to someone
      // who picked a genuine PDF — see FileEmptyError.
      if (cause instanceof FileEmptyError) {
        return t('restaurants:partnerMedia.errors.emptyFile')
      }
      // Raised client-side from the authoritative maxBytes, so the copy is
      // already interpolated and there is no response body to prefer over it.
      if (cause instanceof FileTooLargeError) {
        return t('restaurants:partnerMedia.errors.tooLargeClient', {
          max: formatBytes(cause.details.maxBytes),
        })
      }
      // Prefers the backend's own wording — including `details.message`, which
      // carries the section-specific copy — and falls back on the code, never
      // the status.
      return getApiErrorMessage(cause, t(mediaErrorFallbackKey(cause, kind)))
    },
    [t],
  )

  const showMediaError = useCallback(
    (cause: unknown, kind: MediaKind) => {
      showErrorText(resolveMediaError(cause, kind))
    },
    [showErrorText, resolveMediaError],
  )

  return { showSuccess, showErrorText, showMediaError, resolveMediaError }
}

export type MediaFeedback = ReturnType<typeof useMediaFeedback>

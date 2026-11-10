import { useCallback } from 'react'
import { message } from 'antd'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { profileErrorFallbackKey } from '../errors'

export interface ProfileFeedback {
  showSuccess: (text: string) => void
  /**
   * Single-argument by design. This is passed straight to React Query as
   * `onError`, which invokes it as `onError(error, variables, …)` — so an
   * optional second parameter would silently be handed the mutation variables.
   * Modules needing their own fallback copy resolve it before calling
   * {@link ProfileFeedback.showErrorText} (see J6B's `useMediaFeedback`).
   */
  showError: (cause: unknown) => void
  /** Already-resolved copy, for failures raised client-side rather than by the API. */
  showErrorText: (text: string) => void
}

/**
 * One toast channel for the whole profile page.
 *
 * The page composes several controllers (shell, Overview cards, Contacts, and
 * J6B's Documents and Photos & Videos tabs), and giving each its own
 * `message.useMessage()` rendered multiple holders with the same React key — a
 * duplicate-key warning and overlapping toast stacks. This is created once by
 * the page and threaded into the others.
 */
export function useProfileFeedback() {
  const { t } = useTranslation(['restaurants', 'common'])
  const [messageApi, contextHolder] = message.useMessage()

  const showSuccess = useCallback(
    (text: string) => {
      void messageApi.success(text)
    },
    [messageApi],
  )

  // Prefers the backend's own copy; falls back per error code.
  const showError = useCallback(
    (cause: unknown) => {
      void messageApi.error(getApiErrorMessage(cause, t(profileErrorFallbackKey(cause))))
    },
    [messageApi, t],
  )

  /**
   * For client-side failures — an oversized file, a rejected type — where there
   * is no response body to prefer and the copy is already interpolated, so it
   * must not be run through `getApiErrorMessage`.
   */
  const showErrorText = useCallback(
    (text: string) => {
      void messageApi.error(text)
    },
    [messageApi],
  )

  return { contextHolder, showSuccess, showError, showErrorText }
}

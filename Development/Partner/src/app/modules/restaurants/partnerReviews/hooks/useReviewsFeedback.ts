import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { ProfileFeedback } from '../../partnerProfile/hooks/useProfileFeedback'

/**
 * J6G's one toast, on top of the page's single toast channel.
 *
 * **Why a read-only tab has a toast channel at all.** The house convention is that a
 * failed GET renders an inline `Alert` and is never toasted, and both reads follow it —
 * J6F's read-only grid has no feedback channel for exactly this reason. The single
 * exception is a review that has been deleted: the recovery closes the modal and re-reads
 * the list, which removes the region an inline alert would have lived in, so a toast is
 * the only place left to say what happened.
 *
 * There is deliberately no general `showReviewsError` here. Every other failure has
 * somewhere on screen to be reported — the tab body for the list, the open modal for a
 * non-404 detail failure — and adding one would have meant a second, unused path through
 * the error copy.
 */
export function useReviewsFeedback({ showErrorText }: ProfileFeedback) {
  const { t } = useTranslation(['restaurants', 'common'])

  /**
   * The review is gone — deleted by an admin, or never the caller's to read; the API
   * returns the same 404 for both, on purpose.
   *
   * Deliberately not run through `getApiErrorMessage`: the 404 body's message is the
   * API's terse "Review not found.", and this surface needs to tell the partner that the
   * list is being refreshed, not that a lookup failed.
   */
  const showReviewGone = useCallback(() => {
    showErrorText(t('restaurants:partnerReviews.errors.notFound'))
  }, [showErrorText, t])

  return { showReviewGone }
}

export type ReviewsFeedback = ReturnType<typeof useReviewsFeedback>

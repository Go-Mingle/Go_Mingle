import { Alert, Image, Modal, Spin } from 'antd'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { StarRating } from '../../../../atoms/StarRating'
import { reviewsErrorFallbackKey } from '../errors'
import { displayOrDash, minglerInitials } from '../format'
import type { ReviewsTabController } from '../hooks/useReviewsTab'

/**
 * The Review Details modal (US-02, BR-06).
 *
 * Read-only and close-only — there is no delete, reply or flag, and no endpoint behind
 * one (BR-02, AC-02.2).
 *
 * Driven by the controller rather than owning its own query, because it needs the 404
 * handling that lives there: a review an admin has deleted closes this modal, toasts
 * once, and refreshes the list, so by the time that state settles there is no modal
 * left to render an error in. What reaches `reviewDetailError` here is therefore only a
 * *real* failure, which does get an in-modal alert.
 */
export function ReviewDetailsModal({ c }: { c: ReviewsTabController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const detail = c.reviewDetail

  return (
    <Modal
      open={Boolean(c.openReviewId)}
      title={t('restaurants:partnerReviews.detail.title')}
      width={520}
      destroyOnHidden
      onCancel={c.closeReview}
      footer={null}
      closable
    >
      {c.reviewDetailPending && (
        <div className="flex justify-center py-10">
          <Spin />
        </div>
      )}

      {c.reviewDetailError && (
        <Alert
          type="error"
          // Prefers the backend's own wording, falling back on the error **code** rather
          // than a blanket "failed to load".
          message={getApiErrorMessage(
            c.reviewDetailErrorCause,
            t(reviewsErrorFallbackKey(c.reviewDetailErrorCause)),
          )}
        />
      )}

      {!c.reviewDetailPending && !c.reviewDetailError && detail && (
        <div>
          {/* Reviewer, then the rating */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-coral)] text-[11px] font-bold text-white"
              >
                {minglerInitials(detail.mingler.name)}
              </span>
              <span className="truncate text-sm font-semibold text-[var(--color-text)]">
                {displayOrDash(detail.mingler.name)}
              </span>
            </div>
            <StarRating
              rating={detail.rating}
              size={16}
              label={t('restaurants:partnerReviews.summary.ratedOutOfFive', {
                rating: detail.rating,
              })}
            />
          </div>

          {/* Rendered exactly as the server sent it — `15 Apr 2026`, deliberately a
              different format from the row's `15-04-2026`. Neither is reformatted. */}
          <div className="mt-3 flex justify-end text-[13px] text-[var(--color-text-muted)]">
            {detail.date}
          </div>

          <div className="my-4 border-t border-[var(--color-divider)]" />

          {/* The full, untruncated review. A rating with no words is legal. */}
          {detail.text?.trim() ? (
            <p className="text-sm font-normal leading-[1.7] text-[var(--color-text)]">
              {detail.text}
            </p>
          ) : (
            <p className="text-sm italic text-[var(--color-text-muted)]">
              {t('restaurants:partnerReviews.noText')}
            </p>
          )}

          {/* Absent in every environment until the review-photos bucket is configured,
              so `[]` is the normal case and simply renders nothing. */}
          {detail.photos.length > 0 && (
            <div className="mt-5 border-t border-[var(--color-divider)] pt-4">
              <Image.PreviewGroup>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                  {detail.photos.map((url) => (
                    <span
                      key={url}
                      className="aspect-square w-full overflow-hidden rounded-[8px] border border-[var(--color-border)] bg-[var(--color-page)]"
                    >
                      <Image
                        src={url}
                        alt={t('restaurants:partnerReviews.reviewPhoto')}
                        width="100%"
                        height="100%"
                        className="object-cover"
                        preview={{ mask: false }}
                      />
                    </span>
                  ))}
                </div>
              </Image.PreviewGroup>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}

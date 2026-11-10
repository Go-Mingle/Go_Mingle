import { Progress } from 'antd'
import { Star } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { StarRating } from '../../../../atoms/StarRating'
import { REVIEW_RATINGS } from '../constants'
import { averageLabel, distributionPercent } from '../format'
import type { ReviewsSummary as Summary } from '../types'

/**
 * The ratings summary block (BR-03) — average, all-time count, 1–5★ histogram.
 *
 * Every number here comes from the server's `summary`, which is computed over **every**
 * review the restaurant has received and does not change when a filter is applied. So
 * this block legitimately reads "8 reviews" above three filtered rows. The prototype
 * card computed all three from the page it had in memory, which made the histogram
 * describe only the visible page.
 */
/**
 * Pins AntD's `Progress` to the 6px track with a 4px radius that the design uses,
 * and zeroes the margins it adds by default — without them the histogram rows sit
 * taller than the design's.
 */
const BAR_GEOMETRY = [
  '[&_.ant-progress]:m-0',
  '[&_.ant-progress-line]:m-0',
  '[&_.ant-progress-outer]:m-0',
  '[&_.ant-progress-outer]:p-0',
  '[&_.ant-progress-inner]:h-1.5',
  '[&_.ant-progress-inner]:rounded-[4px]',
  '[&_.ant-progress-bg]:h-1.5',
  '[&_.ant-progress-bg]:rounded-[4px]',
].join(' ')

export function ReviewsSummary({ summary }: { summary: Summary }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const average = averageLabel(summary.average)

  return (
    <div className="mb-4 flex flex-wrap items-start gap-10 rounded-[var(--radius-lg)] bg-[var(--color-card)] p-6 shadow-[var(--shadow-sm)]">
      {/* Mobile puts the score beside the stars; desktop stacks them. */}
      <div className="flex min-w-[80px] flex-row items-center gap-3 md:flex-col md:gap-1">
        <span
          className="text-[40px] font-extrabold leading-none text-[var(--color-text)]"
          aria-label={t('restaurants:partnerReviews.summary.averageLabel')}
        >
          {average}
        </span>
        <div className="flex flex-col items-start gap-0.5 md:items-center">
          <StarRating
            rating={summary.average}
            size={16}
            label={t('restaurants:partnerReviews.summary.ratedOutOfFive', { rating: average })}
          />
          <span className="text-xs text-[var(--color-text-muted)]">
            {t('restaurants:partnerReviews.summary.reviewCount', { count: summary.total })}
          </span>
        </div>
      </div>

      <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
        {/* Highest first, as the design shows. All five keys always arrive. */}
        {[...REVIEW_RATINGS].reverse().map((star) => (
          <DistributionRow
            key={star}
            star={star}
            count={summary.distribution[String(star) as '1' | '2' | '3' | '4' | '5']}
            total={summary.total}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * One histogram row.
 *
 * The bar is AntD's `Progress` rather than a hand-rolled div, because a bar width is
 * inherently dynamic and Tailwind classes are compiled statically — the prototype card
 * resorted to an inline `style={{ '--bar-width': … }}`, which the repo's Tailwind-only
 * rule disallows. `Progress` is already the house answer for this (J6B's upload bar),
 * so it needs no new CSS and no escape hatch.
 */
function DistributionRow({ star, count, total }: { star: number; count: number; total: number }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const percent = distributionPercent(count, total)

  return (
    <div className="flex items-center gap-2">
      <span className="w-2 shrink-0 text-right text-xs text-[var(--color-text-muted)]">{star}</span>
      <Star
        size={11}
        // `fill` weight, not just the colour — see StarRating's note (MET-1312). At 11px
        // the outline weight painted amber was all but invisible.
        weight="fill"
        fill="var(--color-rating)"
        className="shrink-0"
        role="img"
        aria-label={t('restaurants:partnerReviews.summary.starLabel', { star })}
      />
      <div
        className={`flex-1 ${BAR_GEOMETRY}`}
        data-testid={`distribution-bar-${String(star)}`}
        data-percent={percent}
      >
        <Progress
          percent={percent}
          showInfo={false}
          size="small"
          strokeColor="var(--color-rating)"
          railColor="var(--color-divider)"
          aria-hidden
        />
      </div>
      <span className="w-4 shrink-0 text-right text-xs text-[var(--color-text-muted)]">
        {count}
      </span>
    </div>
  )
}

import { Star } from '@phosphor-icons/react'
import { Grid } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Review } from '../restaurantDetail.types'
import { StarRating } from '../restaurantDetail.utils'

interface ReviewsSummaryCardProps {
  reviews: Review[]
  avgRating: number
  totalReviews: number
}

export function ReviewsSummaryCard({ reviews, avgRating, totalReviews }: ReviewsSummaryCardProps) {
  const { t } = useTranslation('restaurants')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const starDist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
  }))
  const positiveCount = reviews.filter((r) => r.rating >= 4).length
  const neutralCount = reviews.filter((r) => r.rating === 3).length
  const negativeCount = reviews.filter((r) => r.rating <= 2).length

  return (
    <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-6 shadow-[var(--shadow-sm)] mb-4 flex gap-10 flex-wrap items-start">
      <div className="flex flex-col items-center gap-1 min-w-[80px]">
        <span className="text-[40px] font-extrabold text-[var(--color-text)] leading-none">
          {avgRating.toFixed(1)}
        </span>
        <StarRating rating={Math.round(avgRating)} size={16} />
        <span className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {totalReviews} review{totalReviews !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="flex-1 min-w-[200px] flex flex-col gap-1.5">
        {starDist.map(({ star, count }) => (
          <div key={star} className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] w-2 text-right shrink-0">
              {star}
            </span>
            <Star size={11} fill="#F59E0B" stroke="#F59E0B" className="shrink-0" />
            <div className="flex-1 h-1.5 bg-[var(--color-divider)] rounded-[3px] overflow-hidden">
              <div
                className="h-full bg-[#F59E0B] rounded-[3px] transition-[width_400ms_ease]"
                style={{ width: totalReviews > 0 ? `${(count / totalReviews) * 100}%` : '0%' }}
              />
            </div>
            <span className="text-xs text-[var(--color-text-muted)] w-4 text-right shrink-0">
              {count}
            </span>
          </div>
        ))}
      </div>

      <div
        style={
          isMobile
            ? { display: 'flex', gap: 8, width: '100%' }
            : { display: 'flex', gap: 16, flexWrap: 'wrap' }
        }
      >
        {[
          {
            label: t('reviews.positive'),
            count: positiveCount,
            color: 'var(--color-success)',
            bg: 'var(--color-success-bg)',
          },
          {
            label: t('reviews.neutral'),
            count: neutralCount,
            color: 'var(--color-warning)',
            bg: 'var(--color-warning-bg)',
          },
          {
            label: t('reviews.negative'),
            count: negativeCount,
            color: 'var(--color-error)',
            bg: 'var(--color-error-bg)',
          },
        ].map(({ label, count, color, bg }) =>
          isMobile ? (
            <div
              key={label}
              style={{
                flex: 1,
                background: bg,
                borderRadius: 'var(--radius-md)',
                padding: '10px 8px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{count}</div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                  color,
                }}
              >
                {label}
              </div>
            </div>
          ) : (
            <div
              key={label}
              className="rounded-[var(--radius-md)] px-4 py-[10px] text-center min-w-[72px]"
              style={{ background: bg }}
            >
              <div className="text-[20px] font-bold" style={{ color }}>
                {count}
              </div>
              <div
                className="text-[11px] font-semibold uppercase tracking-[0.04em] mt-0.5"
                style={{ color }}
              >
                {label}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  )
}

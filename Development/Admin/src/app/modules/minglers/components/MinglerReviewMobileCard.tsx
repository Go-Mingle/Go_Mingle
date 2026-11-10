import { Flex, Tooltip } from 'antd'
import { Star, Trash } from '@phosphor-icons/react'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { useTranslation } from 'react-i18next'
import type { MinglerReview } from '../types'
import { ReviewPhotoStrip } from './ReviewPhotoStrip'

// Reviews API sends `date` as "DD-MM-YYYY"; parse with the source format.
dayjs.extend(customParseFormat)
const API_DATE_FORMAT = 'DD-MM-YYYY'

interface MinglerReviewMobileCardProps {
  review: MinglerReview
  minglerName: string
  minglerInitials: string
  onOpenReview: (r: MinglerReview) => void
  onDeleteReview: (id: string) => void
}

export function MinglerReviewMobileCard({
  review,
  minglerName,
  minglerInitials,
  onOpenReview,
  onDeleteReview,
}: MinglerReviewMobileCardProps) {
  const { t } = useTranslation('minglers')

  return (
    <div
      onClick={() => onOpenReview(review)}
      style={{
        background: 'var(--color-card)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        padding: 16,
        cursor: 'pointer',
      }}
    >
      {/* Row 1: avatar + name + stars */}
      <Flex justify="space-between" align="center" gap={10}>
        <Flex align="center" gap={8}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--color-coral)',
              color: '#fff',
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {minglerInitials}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>
            {minglerName}
          </span>
        </Flex>
        <div style={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              size={14}
              weight={i <= review.rating ? 'fill' : 'regular'}
              color={i <= review.rating ? '#F59E0B' : 'var(--color-border-strong)'}
            />
          ))}
        </div>
      </Flex>

      {/* Row 2: date */}
      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4 }}>
        {dayjs(review.date, API_DATE_FORMAT).format('DD MMM YYYY')}
      </div>

      {/* Row 3: review text */}
      <div
        style={{
          fontSize: 13,
          color: 'var(--color-text)',
          paddingTop: 8,
          borderTop: '1px solid var(--color-divider)',
          marginTop: 8,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {review.bodyPreview}
      </div>

      {/* Photo thumbnails */}
      {review.photoUrls && review.photoUrls.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <ReviewPhotoStrip photos={review.photoUrls} />
        </div>
      )}

      {/* Row 4: actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 8,
          paddingTop: 8,
          borderTop: '1px solid var(--color-divider)',
          marginTop: 8,
        }}
      >
        <Tooltip title={t('deleteReview.confirm')}>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteReview(review.id)
            }}
            aria-label={t('deleteReview.confirm')}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-error-bg)',
              color: 'var(--color-error)',
              border: '1.5px solid var(--color-error-border)',
              borderRadius: 12,
              cursor: 'pointer',
            }}
          >
            <Trash size={15} weight="regular" />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

import { Modal, Flex, Image, Spin } from 'antd'
import { Star, Trash } from '@phosphor-icons/react'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { useTranslation } from 'react-i18next'
import { useReviewDetailQuery } from '../hooks/useReviewsQuery'

// The reviews API sends `date` as "DD-MM-YYYY" (not ISO); dayjs needs the
// source format or it yields "Invalid Date".
dayjs.extend(customParseFormat)
const API_DATE_FORMAT = 'DD-MM-YYYY'

interface MinglerReviewDetailModalProps {
  open: boolean
  reviewId: string | null
  onCancel: () => void
  onDelete?: (id: string) => void
}

function initialsFrom(name: string): string {
  return name
    .split(' ')
    .filter((w) => /[a-zA-Z]/.test(w))
    .map((w) => w[0].toUpperCase())
    .join('')
    .slice(0, 2)
}

export function MinglerReviewDetailModal({
  open,
  reviewId,
  onCancel,
  onDelete,
}: MinglerReviewDetailModalProps) {
  const { t } = useTranslation('minglers')
  const { data: review, isLoading } = useReviewDetailQuery(reviewId, open)

  return (
    <Modal
      open={open}
      title={t('reviewModal.title')}
      width={520}
      onCancel={onCancel}
      footer={null}
      destroyOnClose
    >
      {isLoading && (
        <Flex justify="center" align="center" style={{ padding: '32px 0' }}>
          <Spin />
        </Flex>
      )}

      {!isLoading && review && (
        <div style={{ fontFamily: 'Poppins, sans-serif' }}>
          {onDelete && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                onClick={() => onDelete(review.id)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 34,
                  padding: '0 14px',
                  background: 'var(--color-error-bg)',
                  color: 'var(--color-error)',
                  border: '1.5px solid var(--color-error-border)',
                  borderRadius: 12,
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Trash size={13} weight="regular" />
                {t('reviewModal.deleteButton')}
              </button>
            </div>
          )}

          {/* Row 1: avatar + name + stars */}
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={10}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--color-coral)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {initialsFrom(review.minglerName)}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
                {review.minglerName}
              </span>
            </Flex>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  size={16}
                  weight={i <= review.rating ? 'fill' : 'regular'}
                  color={i <= review.rating ? '#F59E0B' : 'var(--color-border-strong)'}
                />
              ))}
            </div>
          </Flex>

          {/* Row 2: restaurant + date */}
          <Flex justify="space-between" style={{ marginTop: 12, fontSize: 13 }}>
            <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
              {review.restaurantName}
            </span>
            <span style={{ color: 'var(--color-text-muted)' }}>
              {dayjs(review.date, API_DATE_FORMAT).format('DD MMM YYYY')}
            </span>
          </Flex>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--color-divider)', margin: '16px 0' }} />

          {/* Review text */}
          <div
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: 'var(--color-text)',
              lineHeight: 1.7,
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {review.body}
          </div>

          {/* Photo gallery */}
          {review.photoUrls && review.photoUrls.length > 0 && (
            <div
              style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-divider)' }}
            >
              <Image.PreviewGroup>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
                    gap: 8,
                  }}
                >
                  {review.photoUrls.map((url, idx) => (
                    <div
                      key={`${url}-${idx}`}
                      style={{
                        width: '100%',
                        aspectRatio: '1 / 1',
                        borderRadius: 8,
                        overflow: 'hidden',
                        border: '1px solid var(--color-border)',
                        background: 'var(--color-page)',
                      }}
                    >
                      <Image
                        src={url}
                        alt=""
                        width="100%"
                        height="100%"
                        style={{ objectFit: 'cover' }}
                        preview={{ mask: false }}
                      />
                    </div>
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

/* eslint-disable react-refresh/only-export-components */
import { Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  Star,
  Trash,
  Receipt,
  MagnifyingGlass,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  Funnel,
} from '@phosphor-icons/react'
import type { Review } from '../restaurantDetail.types'
import { TableSearchFilter } from './TableSearchFilter'
import i18n from '../../../../locales/i18n'

const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

const funnelIcon = (filtered: boolean) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

export function buildReviewsColumns(
  onDelete: (review: Review) => void,
  onViewBooking: (bookingId: string) => void,
  onMinglerClick?: (review: Review) => void,
): ColumnsType<Review> {
  const t = i18n.t.bind(i18n)
  return [
    {
      title: t('restaurants:reviews.colDate'),
      dataIndex: 'date',
      key: 'date',
      sorter: true,
      sortIcon: tableSortIcon,
      render: (v: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-muted)',
          }}
        >
          {new Date(v).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      title: t('restaurants:reviews.colMingler'),
      dataIndex: 'mingler',
      key: 'mingler',
      render: (_: string, record: Review) => {
        const clickable = !!onMinglerClick && !!record.minglerId
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 28,
                height: 28,
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
              {record.minglerInitials}
            </div>
            <span
              role={clickable ? 'button' : undefined}
              onClick={
                clickable
                  ? (e) => {
                      e.stopPropagation()
                      onMinglerClick(record)
                    }
                  : undefined
              }
              style={{
                fontFamily: 'Poppins, sans-serif',
                fontSize: 14,
                fontWeight: 500,
                color: clickable ? 'var(--color-accent)' : 'var(--color-text)',
                cursor: clickable ? 'pointer' : 'default',
              }}
              onMouseEnter={(e) => {
                if (clickable) e.currentTarget.style.textDecoration = 'underline'
              }}
              onMouseLeave={(e) => {
                if (clickable) e.currentTarget.style.textDecoration = 'none'
              }}
            >
              {record.mingler}
            </span>
          </div>
        )
      },
    },
    {
      title: t('restaurants:reviews.colInterestTable'),
      dataIndex: 'interestTable',
      key: 'interestTable',
      sorter: true,
      sortIcon: tableSortIcon,
      render: (v?: string) => (
        <span
          style={{
            fontFamily: 'Poppins, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
          }}
        >
          {v ?? '—'}
        </span>
      ),
    },
    {
      title: t('restaurants:reviews.colRating'),
      dataIndex: 'rating',
      key: 'rating',
      sorter: true,
      sortIcon: tableSortIcon,
      filters: [5, 4, 3, 2, 1].map((n) => ({ text: `${n} Stars`, value: n })),
      filterIcon: funnelIcon,
      render: (rating: number) => (
        <span style={{ display: 'inline-flex', gap: 2 }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              size={15}
              weight={i <= rating ? 'fill' : 'regular'}
              color={i <= rating ? '#F59E0B' : 'var(--color-border-strong)'}
            />
          ))}
        </span>
      ),
    },
    {
      title: t('restaurants:reviews.colReview'),
      dataIndex: 'text',
      key: 'text',
      filterDropdown: (props) => (
        <TableSearchFilter {...props} placeholder={t('restaurants:reviews.colReview')} />
      ),
      filterIcon: (filtered: boolean) => (
        <MagnifyingGlass
          size={14}
          weight={filtered ? 'fill' : 'regular'}
          style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
        />
      ),
      render: (text: string, record: Review) => {
        const photos = record.photos ?? []
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
            <Tooltip title={text} placement="topLeft">
              <span
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  cursor: 'default',
                }}
              >
                {text}
              </span>
            </Tooltip>
            {photos.length > 0 && <ReviewPhotoStrip photos={photos} />}
          </div>
        )
      },
    },
    {
      title: '',
      key: 'actions',
      width: 88,
      align: 'center' as const,
      render: (_: unknown, record: Review) => (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title={t('restaurants:reviews.viewBooking')} placement="top">
            <div
              onClick={(e) => {
                e.stopPropagation()
                if (record.bookingId) onViewBooking(record.bookingId)
              }}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                cursor: record.bookingId ? 'pointer' : 'default',
                transition: 'all 150ms ease-out',
                color: 'var(--color-text-muted)',
              }}
              onMouseEnter={(e) => {
                if (!record.bookingId) return
                e.currentTarget.style.background = 'var(--color-accent-light)'
                e.currentTarget.style.color = 'var(--color-accent)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--color-text-muted)'
              }}
            >
              <Receipt size={17} weight="regular" />
            </div>
          </Tooltip>
          <Tooltip title={t('restaurants:reviews.deleteReview')}>
            <div
              onClick={(e) => {
                e.stopPropagation()
                onDelete(record)
              }}
              style={{
                width: 32,
                height: 32,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'background 150ms ease-out',
                margin: '0 auto',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-error-bg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Trash size={16} color="var(--color-error)" />
            </div>
          </Tooltip>
        </div>
      ),
    },
  ]
}

function ReviewPhotoStrip({ photos }: { photos: string[] }) {
  const visible = photos.slice(0, 3)
  const overflow = photos.length - visible.length
  return (
    // No stopPropagation here — clicking on the photo strip should fall through
    // to the row's onClick so the review-detail modal opens (with the full
    // photo gallery inside).
    <div style={{ display: 'flex', gap: 4 }}>
      {visible.map((url, i) => (
        <div
          key={`${url}-${i}`}
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            overflow: 'hidden',
            background: 'var(--color-page)',
            border: '1px solid var(--color-border)',
            position: 'relative',
          }}
        >
          <img
            src={url}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
          {i === visible.length - 1 && overflow > 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.55)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'Poppins, sans-serif',
              }}
            >
              +{overflow}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// Re-export for use in onRowClick without needing to use the parameter
export type { Review }

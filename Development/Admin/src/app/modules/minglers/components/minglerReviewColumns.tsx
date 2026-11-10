import type { Key } from 'react'
import { Tooltip, Flex } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { Star, Trash } from '@phosphor-icons/react'
import type { TFunction } from 'i18next'
import type { MinglerReview, ListReviewsQueryParams } from '../types'
import { tableSortIcon, funnelIcon, makeSearchFilter } from './tableHelpers'
import { ReviewPhotoStrip } from './ReviewPhotoStrip'

interface BuildReviewColumnsArgs {
  t: TFunction
  queryParams: ListReviewsQueryParams
  onSearchChange: (value: string | undefined) => void
  onDeleteReview: (id: string) => void
}

export function buildReviewColumns({
  t,
  queryParams,
  onSearchChange,
  onDeleteReview,
}: BuildReviewColumnsArgs): ColumnsType<MinglerReview> {
  const sortOrderFor = (field: ListReviewsQueryParams['sortBy']) =>
    queryParams.sortBy === field ? (queryParams.sortOrder === 'asc' ? 'ascend' : 'descend') : null

  return [
    {
      title: t('reviewCols.date'),
      dataIndex: 'date',
      key: 'date',
      sorter: true,
      sortOrder: sortOrderFor('date'),
      sortIcon: tableSortIcon,
      render: (v: string) => (
        <span
          style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-text-muted)' }}
        >
          {v}
        </span>
      ),
    },
    {
      // Shell column — the reviews list API does not return the restaurant name;
      // it is available on the review detail (opened via row-click).
      title: t('reviewCols.restaurant'),
      dataIndex: 'restaurant',
      key: 'restaurant',
      render: () => (
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          —
        </span>
      ),
    },
    {
      title: t('reviewCols.interestTable'),
      dataIndex: 'interestTableName',
      key: 'interestTableName',
      render: (v?: string) => (
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
          {v || '—'}
        </span>
      ),
    },
    {
      title: t('reviewCols.rating'),
      dataIndex: 'rating',
      key: 'rating',
      sorter: true,
      sortOrder: sortOrderFor('rating'),
      sortIcon: tableSortIcon,
      filters: [
        { text: '5 Stars', value: 5 },
        { text: '4 Stars', value: 4 },
        { text: '3 Stars', value: 3 },
        { text: '2 Stars', value: 2 },
        { text: '1 Star', value: 1 },
      ],
      filteredValue: (queryParams.ratingFilter ?? []) as unknown as Key[],
      filterIcon: funnelIcon,
      // Server-side filter — no local onFilter; the confirmed values flow to the
      // query params via the table's onChange handler.
      render: (v: number) => (
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={15}
              weight={i < v ? 'fill' : 'regular'}
              color={i < v ? '#F59E0B' : 'var(--color-border-strong)'}
            />
          ))}
        </div>
      ),
    },
    {
      title: t('reviewCols.review'),
      dataIndex: 'bodyPreview',
      key: 'bodyPreview',
      filteredValue: queryParams.q ? [queryParams.q] : [],
      ...makeSearchFilter(t('table.search.reviews'), onSearchChange),
      render: (v: string, record: MinglerReview) => {
        const photos = record.photoUrls ?? []
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
            <Tooltip title={v} placement="topLeft">
              <span
                style={{
                  fontSize: 14,
                  color: 'var(--color-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                  cursor: 'default',
                }}
              >
                {v}
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
      width: 64,
      align: 'center' as const,
      render: (_: unknown, record: MinglerReview) => (
        <Flex align="center" justify="center" onClick={(e) => e.stopPropagation()}>
          <Tooltip title={t('deleteReview.confirm')} placement="top">
            <div
              role="button"
              aria-label={t('deleteReview.confirm')}
              onClick={(e) => {
                e.stopPropagation()
                onDeleteReview(record.id)
              }}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                cursor: 'pointer',
                color: 'var(--color-error)',
                transition: 'all 150ms ease-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-error-bg)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent'
              }}
            >
              <Trash size={16} />
            </div>
          </Tooltip>
        </Flex>
      ),
    },
  ]
}

import { useState } from 'react'
import { withFixedEnds } from '../../molecules/withFixedEnds'
import { useNavigate } from 'react-router-dom'
import { Table, Modal, Grid, Image, Spin, Alert } from 'antd'
import type { TablePaginationConfig } from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { Star } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Review } from './restaurantDetail.types'
import type { ListReviewsParams, ReviewRating } from './restaurantApi.types'
import { ReviewsSummaryCard } from './components/ReviewsSummaryCard'
import { buildReviewsColumns } from './components/ReviewsTableColumns'
import { BookingDetailTabsModal } from './components/BookingDetailTabsModal'
import { reviewRowToView, bookingDetailToBooking } from './components/reviewsMappers'
import { REVIEWS_PAGE_SIZE } from './constants'
import { formatLongDate } from '../../../shared/utils/dateHelpers'
import {
  useRestaurantReviewsQuery,
  useReviewDetailQuery,
  useBookingDetailQuery,
} from './hooks/useRestaurantsQuery'

interface Props {
  restaurantId: string | undefined
  onDeleteReviewRequest: (review: Review) => void
}

// AntD column key → reviews API sortBy field
const SORT_FIELD_MAP: Record<string, ListReviewsParams['sortBy']> = {
  date: 'date',
  rating: 'rating',
  interestTable: 'interestTableName',
}

export function RestaurantReviewsTab({ restaurantId, onDeleteReviewRequest }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])
  const navigate = useNavigate()
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const [params, setParams] = useState<ListReviewsParams>({ page: 1, pageSize: REVIEWS_PAGE_SIZE })
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null)

  const { data, isPending, isError, isFetching } = useRestaurantReviewsQuery(restaurantId, params)
  const bookingQuery = useBookingDetailQuery(selectedBookingId ?? undefined)
  const reviewDetailQuery = useReviewDetailQuery(selectedReviewId ?? undefined)

  if (isPending) {
    return (
      <div className="flex justify-center p-8">
        <Spin />
      </div>
    )
  }
  if (isError) {
    return (
      <div className="pt-5">
        <Alert type="error" showIcon message={t('common:errors.genericError')} />
      </div>
    )
  }

  const reviews = data.items.map(reviewRowToView)
  const { summary, pagination } = data

  const columns = buildReviewsColumns(
    onDeleteReviewRequest,
    (bookingId) => setSelectedBookingId(bookingId),
    (review) => {
      if (review.minglerId)
        navigate(`/minglers/${review.minglerId}`, {
          state: { backLabel: t('common:backTo.reviews') },
        })
    },
  )

  const handleTableChange = (
    pagination: TablePaginationConfig,
    filters: Record<string, FilterValue | null>,
    sorter: SorterResult<Review> | SorterResult<Review>[],
  ) => {
    const activeSorter = Array.isArray(sorter) ? sorter[0] : sorter
    const sortKey = activeSorter?.columnKey as string | undefined
    const sortBy = sortKey ? SORT_FIELD_MAP[sortKey] : undefined
    const sortOrder = activeSorter?.order
      ? activeSorter.order === 'ascend'
        ? ('asc' as const)
        : ('desc' as const)
      : undefined

    const ratingArr = (filters.rating as number[] | null)?.map((r) => r as ReviewRating)
    const textSearch = (filters.text?.[0] as string | undefined) ?? undefined

    setParams((prev) => {
      const nextSortBy = sortOrder ? sortBy : undefined
      const nextRating = ratingArr?.length ? ratingArr : undefined
      const nextQ = textSearch || undefined

      // Only sort/filter/search changes reset to page 1. A pure pagination
      // click leaves these untouched, so honor the page AntD reports instead.
      const sortOrFilterChanged =
        nextSortBy !== prev.sortBy ||
        sortOrder !== prev.sortOrder ||
        nextQ !== prev.q ||
        JSON.stringify(nextRating ?? []) !== JSON.stringify(prev.ratingFilter ?? [])

      return {
        ...prev,
        page: sortOrFilterChanged ? 1 : (pagination.current ?? prev.page),
        sortBy: nextSortBy,
        sortOrder,
        ratingFilter: nextRating,
        q: nextQ,
      }
    })
  }

  if (reviews.length === 0 && summary.total === 0) {
    return (
      <div className="pt-5">
        <div className="bg-[var(--color-card)] rounded-[var(--radius-lg)] p-12 text-center text-[var(--color-text-muted)] text-sm">
          {t('reviews.noReviews')}
        </div>
      </div>
    )
  }

  const bookingRecord = bookingQuery.data ? bookingDetailToBooking(bookingQuery.data) : null
  const detail = reviewDetailQuery.data

  return (
    <div className="pt-5">
      <div className={isMobile ? 'reviews-summary-mobile mb-4' : 'mb-6'}>
        <ReviewsSummaryCard
          reviews={reviews}
          avgRating={summary.average}
          totalReviews={summary.total}
        />
      </div>

      <div className="restaurant-detail-reviews-table">
        <Table<Review>
          dataSource={reviews}
          columns={withFixedEnds(columns)}
          rowKey="id"
          size="middle"
          loading={isFetching}
          onChange={handleTableChange}
          pagination={{
            current: pagination.page,
            pageSize: pagination.pageSize,
            total: pagination.totalRecords,
            showSizeChanger: false,
          }}
          onRow={(record) => ({
            onClick: () => setSelectedReviewId(record.id),
            style: { cursor: 'pointer' },
          })}
        />
      </div>

      {/* Booking details modal — sourced from GET /api/v1/admin/bookings/:id */}
      <BookingDetailTabsModal
        open={!!selectedBookingId}
        booking={bookingRecord}
        onClose={() => setSelectedBookingId(null)}
      />

      {/* Review detail modal — sourced from GET /api/v1/reviews/:id */}
      <Modal
        open={!!selectedReviewId}
        title={t('reviews.reviewDetails')}
        width={520}
        destroyOnClose
        onCancel={() => setSelectedReviewId(null)}
        footer={null}
        closable
      >
        {reviewDetailQuery.isPending ? (
          <div className="flex justify-center p-6">
            <Spin />
          </div>
        ) : detail ? (
          <div className="font-[Poppins,sans-serif]">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-[var(--color-text)]">
                {detail.minglerName}
              </span>
              <span className="inline-flex gap-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    size={16}
                    weight={i <= detail.rating ? 'fill' : 'regular'}
                    color={i <= detail.rating ? '#F59E0B' : 'var(--color-border-strong)'}
                  />
                ))}
              </span>
            </div>
            <div className="mt-1 text-xs text-[var(--color-text-muted)]">
              {formatLongDate(detail.date)} · {detail.interestTableName}
            </div>
            <div className="my-4 border-t border-[var(--color-divider)]" />
            <p className="text-sm leading-7 text-[var(--color-text)]">{detail.body}</p>
            {detail.photoUrls.length > 0 && (
              <div className="mt-5 border-t border-[var(--color-divider)] pt-4">
                <Image.PreviewGroup>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2">
                    {detail.photoUrls.map((url, idx) => (
                      <Image
                        key={`${url}-${idx}`}
                        src={url}
                        alt=""
                        className="aspect-square rounded-lg object-cover"
                        preview={{ mask: false }}
                      />
                    ))}
                  </div>
                </Image.PreviewGroup>
              </div>
            )}
          </div>
        ) : (
          <Alert type="error" showIcon message={t('common:errors.genericError')} />
        )}
      </Modal>
    </div>
  )
}

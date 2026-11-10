import { useState, type ReactNode } from 'react'
import { Alert, Grid, Select, Spin, Table } from 'antd'
import { Star } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { getApiErrorMessage } from '../../../../../shared/utils/apiError'
import { StarRating } from '../../../../atoms/StarRating'
import { SearchBar } from '../../../../molecules/SearchBar'
import { pinEndColumns } from '../../../../molecules/tableColumns'
import { CardDetailRow, RESPONSIVE_CARD_CLASS } from '../../../../molecules/CardDetailRow'
import { MinglerProfileModal } from '../../partnerInterestTables/components/MinglerProfileModal'
import { BookingDetailsModal } from '../../partnerInterestTables/components/BookingDetailsModal'
import { TabEmptyState } from '../../components/TabEmptyState'
import { displayInterestTable, displayOrDash } from '../format'
import type { ReviewsTabController } from '../hooks/useReviewsTab'
import type { ReviewListItem, ReviewSortBy, ReviewSortOrder } from '../types'
import { buildReviewsColumns } from './reviewsColumns'
import { ReviewDetailsModal } from './ReviewDetailsModal'
import { ReviewsPagination } from './ReviewsPagination'
import { ReviewsSummary } from './ReviewsSummary'

/**
 * The Reviews tab (US-01 to US-04).
 *
 * A read-only mirror of the admin reviews view: no delete, reply or flag anywhere
 * (BR-02, AC-01.6). Search, the rating filter, sorting and paging are all server-side,
 * so what the pagination reports always matches what the server counted — the prototype
 * did all four in memory.
 *
 * Renders in every profile state including PENDING (BR-11): there are no actions to gate.
 */
export function ReviewsTab({ c }: { c: ReviewsTabController }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  if (c.isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (c.isError) {
    return (
      <Alert type="error" message={getApiErrorMessage(c.error, t('common:errors.fetchError'))} />
    )
  }

  // A restaurant with no reviews at all gets BR-09's copy; filters that match nothing
  // are a different situation and need different wording.
  if (c.isEmpty) {
    return (
      <TabEmptyState
        IconComp={Star}
        title={t('restaurants:partnerReviews.emptyTitle')}
        description={t('restaurants:partnerReviews.emptyDesc')}
      />
    )
  }

  const noRows = c.items.length === 0

  /**
   * Filters that match nothing.
   *
   * This copy tells the partner to clear a filter, so it must not take the filter down
   * with the rows. Replacing the whole grid did exactly that: the rating filter lives in
   * the Rating column header, so an over-narrow filter removed the only control that
   * could undo it and stranded the partner on advice about a funnel that was no longer on
   * screen — a reload was the only way out (MET-1314, same cause and same fix as J6F's
   * MET-1259). It now rides in as the table's own empty body, leaving the header, its
   * sorters and the funnel in place.
   */
  const noMatch = (
    <TabEmptyState
      IconComp={Star}
      title={t('restaurants:partnerReviews.noMatchTitle')}
      description={t('restaurants:partnerReviews.noMatchDesc')}
      compact
    />
  )

  return (
    <div className="pt-5">
      {c.summary && <ReviewsSummary summary={c.summary} />}

      <ReviewsToolbar c={c} isMobile={isMobile} />

      {isMobile ? (
        <ReviewsMobileList c={c} noMatch={noMatch} />
      ) : (
        <Table<ReviewListItem>
          rowKey="reviewId"
          dataSource={c.items}
          columns={pinEndColumns(
            buildReviewsColumns({
              t,
              sortBy: c.sortBy,
              sortOrder: c.sortOrder,
              ratingFilter: c.ratingFilter,
              onOpenMingler: c.openMingler,
              onOpenBooking: c.openBooking,
            }),
          )}
          pagination={false}
          size="middle"
          loading={c.isFetching}
          scroll={{ x: 'max-content' }}
          locale={{ emptyText: noMatch }}
          onChange={(_pagination, filters, sorter) => {
            c.applyRatingFilter(filters.rating)
            applySorterChange(sorter, c.applySort)
          }}
          onRow={(review) => ({
            onClick: () => c.openReview(review.reviewId),
            className: 'cursor-pointer',
          })}
          className="partner-reviews-table"
        />
      )}

      {/* Nothing to page through — and "1-0 of 0" alongside the no-match copy would say
          the same thing twice, less clearly. */}
      {!noRows && (
        <ReviewsPagination
          isMobile={isMobile}
          total={c.total}
          currentPage={c.page}
          pageSize={c.pageSize}
          onPageChange={c.changePage}
          onPageSizeChange={c.changePageSize}
        />
      )}

      <ReviewDetailsModal c={c} />
      {/* Both reused from J6F, exactly as the backend intended — same endpoints, same
          payloads, no reviews-specific variants. */}
      <MinglerProfileModal minglerId={c.openMinglerId} onClose={c.closeMingler} />
      <BookingDetailsModal bookingId={c.openBookingId} onClose={c.closeBooking} />
    </div>
  )
}

/**
 * Translates AntD's sorter callback into our `(field, order)` pair.
 *
 * Only ever called with a real direction now: the columns order their
 * `sortDirections` from the current state, so AntD's cleared state — which reports no
 * `columnKey` at all and used to make every header click a no-op (MET-1260) — is
 * unreachable. The guard stays as the boundary check on an untyped callback: an
 * unrecognised key must not reach the query string.
 */
function applySorterChange(
  sorter: unknown,
  applySort: (field: ReviewSortBy, order: ReviewSortOrder) => void,
): void {
  const single = Array.isArray(sorter) ? sorter[0] : sorter
  const { columnKey, order } = (single ?? {}) as {
    columnKey?: unknown
    order?: 'ascend' | 'descend'
  }
  if (columnKey !== 'date' && columnKey !== 'rating') return

  applySort(columnKey, order === 'ascend' ? 'asc' : 'desc')
}

/**
 * Search, plus a sort control for mobile.
 *
 * The search box holds its draft locally and commits on **Enter**: every commit is a
 * request, this repo has no debounce hook, and every other server-side search here
 * commits explicitly too (an AntD column dropdown with a Search button). Clearing the
 * field commits immediately, since nobody expects to press Enter to undo a search.
 *
 * The sort dropdown appears only on mobile — the desktop table sorts from its column
 * headers, and offering both would be two controls for one piece of state.
 */
function ReviewsToolbar({ c, isMobile }: { c: ReviewsTabController; isMobile: boolean }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const [draft, setDraft] = useState(c.search)

  return (
    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
      <SearchBar
        className="flex-1"
        value={draft}
        placeholder={t('restaurants:partnerReviews.searchPlaceholder')}
        onChange={(next) => {
          setDraft(next)
          // An empty field means "show everything again", which should not wait for Enter.
          if (next === '') c.applySearch('')
        }}
        onPressEnter={c.applySearch}
      />

      {isMobile && (
        <Select<string>
          value={`${c.sortBy}-${c.sortOrder}`}
          onChange={(value) => {
            const [field, order] = value.split('-') as [ReviewSortBy, ReviewSortOrder]
            c.applySort(field, order)
          }}
          aria-label={t('restaurants:partnerReviews.sortLabel')}
          className="w-full md:w-[180px]"
          options={[
            { value: 'date-desc', label: t('restaurants:partnerReviews.sortOptions.dateDesc') },
            { value: 'date-asc', label: t('restaurants:partnerReviews.sortOptions.dateAsc') },
            { value: 'rating-desc', label: t('restaurants:partnerReviews.sortOptions.ratingDesc') },
            { value: 'rating-asc', label: t('restaurants:partnerReviews.sortOptions.ratingAsc') },
          ]}
        />
      )}
    </div>
  )
}

/**
 * The `<768px` card list, per the design's table→card rule.
 *
 * The no-match body is rendered here rather than in place of the list, so the search box
 * and the mobile sort control above it stay put for the same reason the desktop header
 * does (MET-1314).
 */
function ReviewsMobileList({ c, noMatch }: { c: ReviewsTabController; noMatch: ReactNode }) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (c.items.length === 0) return noMatch

  return (
    <div className="detail-reviews-card-list">
      {c.items.map((review) => {
        const table = displayInterestTable(review.interestTable)
        return (
          <div key={review.reviewId} className={RESPONSIVE_CARD_CLASS}>
            <button
              type="button"
              onClick={() => c.openReview(review.reviewId)}
              className="w-full cursor-pointer border-none bg-transparent p-0 text-left"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="truncate text-[14px] font-semibold text-[var(--color-text)]">
                  {displayOrDash(review.mingler.name)}
                </span>
                <StarRating
                  rating={review.rating}
                  size={14}
                  label={t('restaurants:partnerReviews.summary.ratedOutOfFive', {
                    rating: review.rating,
                  })}
                />
              </div>

              <p className="mt-2 line-clamp-3 text-[13px] text-[var(--color-text-secondary)]">
                {review.text?.trim() ?? t('restaurants:partnerReviews.noText')}
              </p>
            </button>

            <CardDetailRow
              label={t('restaurants:partnerReviews.columns.date')}
              value={review.date}
            />
            <CardDetailRow
              label={t('restaurants:partnerReviews.columns.interestTable')}
              value={table.topic ? `${table.name} · ${table.topic}` : table.name}
            />

            <div className="mt-2 flex gap-4">
              <button
                type="button"
                onClick={() => c.openMingler(review.mingler.minglerId)}
                className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-[var(--color-accent)]"
              >
                {t('restaurants:partnerReviews.viewProfile', {
                  name: displayOrDash(review.mingler.name),
                })}
              </button>
              <button
                type="button"
                onClick={() => c.openBooking(review.bookingId)}
                className="cursor-pointer border-none bg-transparent p-0 text-[13px] font-medium text-[var(--color-accent)]"
              >
                {t('restaurants:partnerReviews.viewBooking')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

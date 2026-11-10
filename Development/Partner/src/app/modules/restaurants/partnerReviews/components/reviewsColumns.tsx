/* eslint-disable react-refresh/only-export-components */
// A columns factory that also defines its own cell components — the same shape as
// J6F's `interestTablesColumns.tsx`, which carries this disable for the same reason.
// The rule is about HMR granularity, not correctness.
import { Tooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { SortOrder } from 'antd/es/table/interface'
import type { TFunction } from 'i18next'
import { ArrowDown, ArrowsDownUp, ArrowUp, Funnel, Receipt } from '@phosphor-icons/react'
import { StarRating } from '../../../../atoms/StarRating'
import { REVIEW_RATINGS } from '../constants'
import { displayInterestTable, displayOrDash, minglerInitials } from '../format'
import type { ReviewListItem, ReviewRating, ReviewSortBy, ReviewSortOrder } from '../types'

/**
 * The sort affordance for a column.
 *
 * antd renders a custom `sortIcon` **bare** — it does not wrap the returned node in
 * its own `ant-table-column-sorter` span — so an unadorned <svg> leaves the header
 * with a control that has no role and no accessible name: unreachable for screen
 * readers and invisible to selector-based audits, which is how a working control gets
 * counted as absent (MET-1260, same cause as MET-1252). Wrap it and name it.
 */
const tableSortIcon =
  (label: string) =>
  ({ sortOrder }: { sortOrder: SortOrder }) => {
    let icon = <ArrowsDownUp size={12} className="text-[var(--color-text-subtle)]" />
    if (sortOrder === 'ascend') {
      icon = <ArrowUp size={12} weight="bold" className="text-[var(--color-accent)]" />
    } else if (sortOrder === 'descend') {
      icon = <ArrowDown size={12} weight="bold" className="text-[var(--color-accent)]" />
    }
    return (
      <span className="ant-table-column-sorter" role="img" aria-label={label} title={label}>
        {icon}
      </span>
    )
  }

/** Same problem, same fix: antd's filter trigger is a bare `<span>` around our icon. */
const funnelIcon = (label: string) => (filtered: boolean) => (
  <span className="inline-flex" role="img" aria-label={label} title={label}>
    <Funnel
      size={14}
      weight={filtered ? 'fill' : 'regular'}
      className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
    />
  </span>
)

/** AntD's own sort-state names, from our `sortBy`/`sortOrder` pair. */
function sortStateFor(
  column: ReviewSortBy,
  sortBy: ReviewSortBy,
  sortOrder: ReviewSortOrder,
): SortOrder {
  if (column !== sortBy) return null
  return sortOrder === 'asc' ? 'ascend' : 'descend'
}

/**
 * The directions antd may cycle this column through, **current one first**.
 *
 * antd picks the next order as `sortDirections[indexOf(current) + 1]` and returns
 * `undefined` once that runs off the end — and `generateSorterInfo` reports a cleared
 * sort with `columnKey: undefined`, so the handler cannot even tell which header was
 * clicked. That is what made these headers inert (MET-1260): the list defaults to
 * `date`/`descend`, `descend` was the last entry in the default `['ascend','descend']`,
 * so the very first click on Date cleared the sort, produced no columnKey, and was
 * dropped — leaving the state unchanged, no request, no reorder, and no way out of it.
 *
 * A fixed two-way list does not fix it; whichever direction sits last is still a
 * dead end. Ordering the list from the *current* direction keeps the next index in
 * range, so every click resolves to a real direction and the endpoint — which always
 * sorts by something and has no unsorted state — is never asked to clear.
 */
function sortDirectionsFor(state: SortOrder): SortOrder[] {
  return state === 'ascend' ? ['ascend', 'descend'] : ['descend', 'ascend']
}

/** `aria-sort` for the header cell, so the state is machine-readable when unsorted too. */
function ariaSortFor(state: SortOrder): 'ascending' | 'descending' | 'none' {
  if (state === 'ascend') return 'ascending'
  return state === 'descend' ? 'descending' : 'none'
}

interface BuildColumnsParams {
  t: TFunction
  sortBy: ReviewSortBy
  sortOrder: ReviewSortOrder
  ratingFilter: ReviewRating[]
  onOpenMingler: (minglerId: string) => void
  onOpenBooking: (bookingId: string) => void
}

/**
 * The reviews grid columns (BR-04).
 *
 * Everything is **server-driven**: `sorter: true` with no comparator, and the rating
 * filter carries no `onFilter`, because the value round-trips as a query param instead
 * of filtering the page in memory. The prototype's columns did the opposite — local
 * `sorter`, local `onFilter`, and a `mockBookingLookup` import — which is why the row
 * count on screen could disagree with the total.
 *
 * There is deliberately no actions column beyond the booking icon: the partner has no
 * delete, reply or flag on any review (BR-02).
 */
export function buildReviewsColumns({
  t,
  sortBy,
  sortOrder,
  ratingFilter,
  onOpenMingler,
  onOpenBooking,
}: BuildColumnsParams): ColumnsType<ReviewListItem> {
  const dateSort = sortStateFor('date', sortBy, sortOrder)
  const ratingSort = sortStateFor('rating', sortBy, sortOrder)
  const dateLabel = t('restaurants:partnerReviews.columns.date')
  const ratingLabel = t('restaurants:partnerReviews.columns.rating')

  return [
    {
      title: dateLabel,
      dataIndex: 'date',
      key: 'date',
      // Server-side: no comparator, and the current state comes from the request.
      sorter: true,
      sortOrder: dateSort,
      // Never lands on antd's cleared state — see `sortDirectionsFor`.
      sortDirections: sortDirectionsFor(dateSort),
      sortIcon: tableSortIcon(t('restaurants:partnerReviews.sortBy', { column: dateLabel })),
      onHeaderCell: () => ({ 'aria-sort': ariaSortFor(dateSort) }),
      render: (date: string) => (
        // Rendered verbatim — `DD-MM-YYYY` is not parseable, and reformatting it with
        // dayjs (as the prototype did) yields an Invalid Date.
        <span className="whitespace-nowrap text-sm font-medium text-[var(--color-text-secondary)]">
          {date}
        </span>
      ),
    },
    {
      title: t('restaurants:partnerReviews.columns.mingler'),
      dataIndex: ['mingler', 'name'],
      key: 'mingler',
      render: (_: unknown, review: ReviewListItem) => (
        <MinglerCell review={review} onOpen={onOpenMingler} t={t} />
      ),
    },
    {
      title: t('restaurants:partnerReviews.columns.interestTable'),
      key: 'interestTable',
      render: (_: unknown, review: ReviewListItem) => (
        <InterestTableCell interestTable={review.interestTable} />
      ),
    },
    {
      title: ratingLabel,
      dataIndex: 'rating',
      key: 'rating',
      sorter: true,
      sortOrder: ratingSort,
      sortDirections: sortDirectionsFor(ratingSort),
      sortIcon: tableSortIcon(t('restaurants:partnerReviews.sortBy', { column: ratingLabel })),
      onHeaderCell: () => ({ 'aria-sort': ariaSortFor(ratingSort) }),
      /**
       * A **multi-select** server-side filter — the first in this codebase. The
       * endpoint takes a subset of 1–5, so `filterMultiple` stays at AntD's default
       * `true` (unlike J6F's single-status column, which sets it false), `filteredValue`
       * is driven by the request so the header shows what is actually applied, and there
       * is no `onFilter` because nothing is filtered locally.
       */
      // Highest first, matching the summary histogram. AntD reports selections in the
      // order the filters are declared, so this is also the order sent to the server.
      filters: [...REVIEW_RATINGS].reverse().map((rating) => ({
        text: t('restaurants:partnerReviews.ratingFilter', { count: rating }),
        value: rating,
      })),
      filterIcon: funnelIcon(t('restaurants:partnerReviews.filterByRating')),
      filteredValue: ratingFilter.length > 0 ? ratingFilter : null,
      render: (rating: number) => (
        <StarRating
          rating={rating}
          size={15}
          label={t('restaurants:partnerReviews.summary.ratedOutOfFive', { rating })}
        />
      ),
    },
    {
      title: t('restaurants:partnerReviews.columns.review'),
      dataIndex: 'text',
      key: 'text',
      render: (_: unknown, review: ReviewListItem) => <ReviewCell review={review} t={t} />,
    },
    {
      title: '',
      key: 'actions',
      width: 88,
      align: 'center' as const,
      render: (_: unknown, review: ReviewListItem) => (
        <BookingIconCell bookingId={review.bookingId} onOpen={onOpenBooking} t={t} />
      ),
    },
  ]
}

/**
 * The reviewer.
 *
 * The name is a real `<button>` so it is keyboard-reachable — the prototype used a
 * `<span role="button">`, which is not. `stopPropagation` keeps the click from also
 * opening the review-details modal via the row handler.
 *
 * A null name means a deleted Mingler. The cell stays clickable: `minglerId` still
 * resolves, and J6F's modal answers "Profile unavailable" for it, which is more useful
 * than an inert dash.
 */
function MinglerCell({
  review,
  onOpen,
  t,
}: {
  review: ReviewListItem
  onOpen: (minglerId: string) => void
  t: TFunction
}) {
  const name = displayOrDash(review.mingler.name)

  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-coral)] text-[11px] font-bold text-white"
      >
        {minglerInitials(review.mingler.name)}
      </span>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpen(review.mingler.minglerId)
        }}
        aria-label={t('restaurants:partnerReviews.viewProfile', { name })}
        className="cursor-pointer border-none bg-transparent p-0 text-left text-sm font-medium text-[var(--color-accent)] hover:underline"
      >
        {name}
      </button>
    </div>
  )
}

/** Name **and** topic (BR-04), stacked. A null topic drops the second line entirely. */
function InterestTableCell({ interestTable }: { interestTable: ReviewListItem['interestTable'] }) {
  const { name, topic } = displayInterestTable(interestTable)

  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate text-sm font-medium text-[var(--color-text)]">{name}</span>
      {topic && <span className="truncate text-xs text-[var(--color-text-muted)]">{topic}</span>}
    </div>
  )
}

/**
 * The truncated review text plus any photo.
 *
 * Truncation is the client's job — the list `text` is the complete review, not a
 * server-side preview — so the full text goes in a tooltip. A review with no text at
 * all is legal and gets explanatory copy rather than a blank cell.
 */
function ReviewCell({ review, t }: { review: ReviewListItem; t: TFunction }) {
  const hasText = Boolean(review.text?.trim())

  return (
    <div className="flex max-w-[320px] flex-col gap-1.5">
      {hasText ? (
        <Tooltip title={review.text} placement="topLeft">
          <span className="block cursor-default truncate text-sm font-medium text-[var(--color-text-secondary)]">
            {review.text}
          </span>
        </Tooltip>
      ) : (
        <span className="text-sm italic text-[var(--color-text-muted)]">
          {t('restaurants:partnerReviews.noText')}
        </span>
      )}
      {review.photoThumbnails.length > 0 && (
        <ReviewPhotoStrip photos={review.photoThumbnails} t={t} />
      )}
    </div>
  )
}

/**
 * The row's photo strip.
 *
 * These are **not** thumbnails: there is no thumbnail derivative on the platform, so
 * each URL is the full-size image the details modal shows. The box is fixed and the
 * images are lazy-loaded, or a row with several photos would pull several
 * full-resolution files into a 40px slot.
 *
 * No `stopPropagation` — clicking a photo should fall through to the row and open the
 * details modal, where the image is actually viewable.
 */
function ReviewPhotoStrip({ photos, t }: { photos: string[]; t: TFunction }) {
  return (
    <div className="flex gap-1">
      {photos.slice(0, 3).map((url) => (
        <span
          key={url}
          className="h-10 w-10 shrink-0 overflow-hidden rounded-[6px] border border-[var(--color-border)] bg-[var(--color-page)]"
        >
          <img
            src={url}
            alt={t('restaurants:partnerReviews.reviewPhoto')}
            loading="lazy"
            className="block h-full w-full object-cover"
          />
        </span>
      ))}
    </div>
  )
}

/**
 * The trailing booking icon (BR-08).
 *
 * Rendered unconditionally: `reviews.booking_id` went `NOT NULL` in CR-021, so the
 * spec's "hide the icon when null" branch (AC-04.2) is unreachable and building it
 * would be dead code.
 */
function BookingIconCell({
  bookingId,
  onOpen,
  t,
}: {
  bookingId: string
  onOpen: (bookingId: string) => void
  t: TFunction
}) {
  const label = t('restaurants:partnerReviews.viewBooking')

  return (
    <Tooltip title={label} placement="top">
      <button
        type="button"
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation()
          onOpen(bookingId)
        }}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[var(--color-text-muted)] transition-all duration-150 ease-out hover:bg-[var(--color-accent-light)] hover:text-[var(--color-accent)]"
      >
        <Receipt size={17} weight="regular" />
      </button>
    </Tooltip>
  )
}

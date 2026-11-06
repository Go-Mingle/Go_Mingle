import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { ReviewsTab } from '../components/ReviewsTab'
import type { ReviewsTabController } from '../hooks/useReviewsTab'
import type { ReviewListItem, ReviewsSummary } from '../types'

/**
 * Driven through a fake controller rather than MSW, matching J6F's tab test: the
 * controller's own behaviour is covered in `hooks/__tests__/useReviewsTab.test.ts`, and
 * what matters here is that the component renders each state and calls back correctly.
 */

const SUMMARY: ReviewsSummary = {
  average: 4,
  total: 8,
  distribution: { '5': 3, '4': 3, '3': 1, '2': 1, '1': 0 },
}

const FULL: ReviewListItem = {
  reviewId: 'r-1',
  date: '15-04-2026',
  mingler: { minglerId: 'm-1', name: 'Sana Khan' },
  interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
  rating: 5,
  text: 'Flawless Mediterranean dining. The mezze platter was exceptional.',
  photoThumbnails: ['https://cdn.mock.local/reviews/a.jpg'],
  bookingId: 'b-1',
}

/** Every nullable field at once — a deleted Mingler, a removed table, no words. */
const SPARSE: ReviewListItem = {
  reviewId: 'r-2',
  date: '10-04-2026',
  mingler: { minglerId: 'm-2', name: null },
  interestTable: { name: null, topic: null },
  rating: 3,
  text: null,
  photoThumbnails: [],
  bookingId: 'b-2',
}

function controller(overrides: Partial<ReviewsTabController> = {}): ReviewsTabController {
  return {
    items: [FULL, SPARSE],
    summary: SUMMARY,
    total: 2,
    page: 1,
    pageSize: 10,
    search: '',
    ratingFilter: [],
    sortBy: 'date',
    sortOrder: 'desc',
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    isEmpty: false,
    hasFilters: false,
    changePage: vi.fn(),
    changePageSize: vi.fn(),
    applySearch: vi.fn(),
    applyRatingFilter: vi.fn(),
    applySort: vi.fn(),
    openReviewId: null,
    openReview: vi.fn(),
    closeReview: vi.fn(),
    reviewDetail: undefined,
    reviewDetailPending: false,
    reviewDetailError: false,
    reviewDetailErrorCause: null,
    openMinglerId: null,
    openMingler: vi.fn(),
    closeMingler: vi.fn(),
    openBookingId: null,
    openBooking: vi.fn(),
    closeBooking: vi.fn(),
    ...overrides,
  } as ReviewsTabController
}

function renderTab(overrides: Partial<ReviewsTabController> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<ReviewsTab c={c} />) }
}

const originalMatchMedia = window.matchMedia

function setMobile() {
  window.matchMedia = ((query: string) => ({
    matches: /max-width/.test(query),
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('ReviewsTab — states', () => {
  it('spins while the tab loads', () => {
    const { container } = renderTab({ isPending: true })
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it("shows the backend's own message on failure", () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Reviews are unavailable.' } }
    renderTab({ isError: true, error })

    expect(screen.getByText('Reviews are unavailable.')).toBeInTheDocument()
  })

  /** BR-09's exact copy for a restaurant that has never been reviewed. */
  it('shows the empty state for a restaurant with no reviews', () => {
    renderTab({ isEmpty: true, items: [], total: 0 })

    expect(screen.getByText('No reviews yet')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Reviews from Minglers will appear here after your first completed interest table.',
      ),
    ).toBeInTheDocument()
  })

  /** A filtered-to-nothing list is a different situation and keeps the summary visible. */
  it('distinguishes no reviews from no matching reviews', () => {
    renderTab({ items: [], total: 0, hasFilters: true, ratingFilter: [1] })

    expect(screen.getByText('No reviews match your filters')).toBeInTheDocument()
    expect(screen.queryByText('No reviews yet')).not.toBeInTheDocument()
    // The summary stays, because it still describes all eight reviews.
    expect(screen.getByText('8 reviews')).toBeInTheDocument()
  })

  /**
   * MET-1314: the no-match copy says "clear the filters", and the rating filter lives in
   * the Rating column header — so dropping the grid to show that copy removed the only
   * control that could act on it. The advice and the affordance have to be on screen
   * together.
   */
  it('leaves the column headers — and the rating filter — in place with no matching rows', () => {
    renderTab({ items: [], total: 0, hasFilters: true, ratingFilter: [1] })

    expect(screen.getByText('No reviews match your filters')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Filter by rating' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /Sort by Rating/i })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('columnheader', { name: /Date/i })[0]).toBeInTheDocument()
  })

  /**
   * The point of keeping the header is that the filter still *works* from the empty grid,
   * not merely that it is drawn. Deselecting the one active rating is the way out of a
   * filter that matched nothing.
   */
  it('can narrow out of the filter from the empty grid', async () => {
    const { c } = renderTab({ items: [], total: 0, hasFilters: true, ratingFilter: [1] })

    await userEvent.click(screen.getAllByRole('img', { name: 'Filter by rating' })[0])
    await userEvent.click(await screen.findByRole('menuitem', { name: '5 star' }))
    await userEvent.click(screen.getByRole('button', { name: /^ok$/i }))

    expect(c.applyRatingFilter).toHaveBeenCalledWith([5, 1])
  })

  /** AntD's bare "No data" placeholder must not win over our own copy. */
  it('replaces the default table placeholder', () => {
    renderTab({ items: [], total: 0, hasFilters: true, ratingFilter: [1] })
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  it('drops the pager when nothing matches', () => {
    renderTab({ items: [], total: 0, hasFilters: true, ratingFilter: [1] })
    expect(screen.queryByText(/of 0 results/i)).not.toBeInTheDocument()
  })

  /** The card list has no header, but the search box and sort control above it do the job. */
  it('keeps the mobile search and sort controls with no matching rows', () => {
    setMobile()
    renderTab({ items: [], total: 0, hasFilters: true, ratingFilter: [1] })

    expect(screen.getByText('No reviews match your filters')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Search reviews or reviewers')).toBeInTheDocument()
    expect(screen.getByText('Newest first')).toBeInTheDocument()
  })

  it('renders the summary above the list', () => {
    renderTab()

    expect(screen.getByText('4.0')).toBeInTheDocument()
    expect(screen.getByText('8 reviews')).toBeInTheDocument()
  })

  /**
   * The headline is the all-time count and the pager is the filtered one. With a filter
   * active the two legitimately disagree, and each must read its own number.
   */
  it('shows the all-time count in the summary and the filtered count in the pager', () => {
    renderTab({ ratingFilter: [5], total: 3, hasFilters: true })

    expect(screen.getByText('8 reviews')).toBeInTheDocument()
    expect(screen.getByText(/of 3 results/i)).toBeInTheDocument()
  })
})

describe('ReviewsTab — rows', () => {
  it('renders the server-formatted date verbatim', () => {
    renderTab()
    // `DD-MM-YYYY`, not reformatted — dayjs cannot parse it.
    expect(screen.getByText('15-04-2026')).toBeInTheDocument()
  })

  it('renders both the interest table name and topic (BR-04)', () => {
    renderTab()

    expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument()
    expect(screen.getByText('Wine & Dine')).toBeInTheDocument()
  })

  it('renders the reviewer name as a button', () => {
    renderTab()
    expect(screen.getByRole('button', { name: /Sana Khan's profile/i })).toBeInTheDocument()
  })

  it('renders placeholders for the nullable fields rather than "null"', () => {
    renderTab({ items: [SPARSE] })

    expect(
      screen.getByText('This Mingler left a rating without a written review.'),
    ).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText(/null/)).not.toBeInTheDocument()
  })

  /** These are full-size images in a 40px slot, so lazy-loading is not optional. */
  it('lazy-loads the row photo', () => {
    renderTab({ items: [FULL] })
    const photo = screen.getByAltText('Photo attached to this review')

    expect(photo).toHaveAttribute('loading', 'lazy')
    expect(photo).toHaveAttribute('src', 'https://cdn.mock.local/reviews/a.jpg')
  })

  it('renders no photo strip when there are none', () => {
    renderTab({ items: [SPARSE] })
    expect(screen.queryByAltText('Photo attached to this review')).not.toBeInTheDocument()
  })

  /** BR-08 + CR-021 — bookingId is never null, so the icon is unconditional. */
  it('renders the booking icon on every row', () => {
    renderTab()
    expect(screen.getAllByRole('button', { name: 'View booking details' })).toHaveLength(2)
  })

  /** BR-02 / AC-01.6 — no moderation control anywhere. */
  it('offers no delete, reply or flag control', () => {
    renderTab()

    expect(screen.queryByRole('button', { name: /delete|remove|reply|flag|hide/i })).toBeNull()
  })
})

describe('ReviewsTab — interactions', () => {
  it('opens the review details modal on row click', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getByText('15-04-2026'))
    expect(c.openReview).toHaveBeenCalledWith('r-1')
  })

  it('opens the Mingler profile without also opening the review', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getByRole('button', { name: /Sana Khan's profile/i }))

    expect(c.openMingler).toHaveBeenCalledWith('m-1')
    // The row handler must not also fire — the click is stopped at the cell.
    expect(c.openReview).not.toHaveBeenCalled()
  })

  it('opens the booking details without also opening the review', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getAllByRole('button', { name: 'View booking details' })[0])

    expect(c.openBooking).toHaveBeenCalledWith('b-1')
    expect(c.openReview).not.toHaveBeenCalled()
  })

  /** Committed on Enter, not per keystroke — every commit is a request. */
  it('sends the search term on Enter rather than while typing', async () => {
    const { c } = renderTab()
    const box = screen.getByPlaceholderText('Search reviews or reviewers')

    await userEvent.type(box, 'mezze')
    expect(c.applySearch).not.toHaveBeenCalled()

    await userEvent.type(box, '{Enter}')
    expect(c.applySearch).toHaveBeenCalledWith('mezze')
  })

  /** Nobody expects to press Enter to undo a search. */
  it('clears the search immediately', async () => {
    const { c } = renderTab({ search: 'mezze' })
    const box = screen.getByPlaceholderText('Search reviews or reviewers')

    await userEvent.clear(box)
    expect(c.applySearch).toHaveBeenCalledWith('')
  })

  it('asks the controller to change page', async () => {
    const { c } = renderTab({ total: 42 })

    await userEvent.click(screen.getByTitle('2'))
    expect(vi.mocked(c.changePage).mock.calls[0][0]).toBe(2)
  })

  it('offers only the page sizes the endpoint accepts', async () => {
    renderTab({ total: 420 })

    await userEvent.click(screen.getByText('10 / page'))
    for (const size of ['25 / page', '50 / page']) {
      expect(await screen.findByText(size)).toBeInTheDocument()
    }
    // 100 is offered by the shared users pager and refused by this endpoint.
    expect(screen.queryByText('100 / page')).not.toBeInTheDocument()
  })

  it('asks the controller to change page size', async () => {
    const { c } = renderTab({ total: 420 })

    // Opened via the combobox role and the option picked by its dropdown selector: the
    // closed Select renders its current value as plain text too, so text-only queries
    // hit the trigger instead of the option. Same approach as UsersPage's test.
    const combos = screen.getAllByRole('combobox')
    await userEvent.click(combos[combos.length - 1])
    await userEvent.click(
      await screen.findByText('25 / page', { selector: '.ant-select-item-option-content' }),
    )

    expect(c.changePageSize).toHaveBeenCalledWith(25)
  })

  async function openRatingFilter() {
    await userEvent.click(screen.getAllByRole('img', { name: 'Filter by rating' })[0])
  }

  /**
   * The rating filter exists and always has — but antd renders a custom `filterIcon`
   * bare, so with an unnamed <svg> inside it the trigger had no accessible name and
   * read as absent (MET-1260).
   */
  it('names the rating filter trigger so it is discoverable', () => {
    renderTab()
    expect(screen.getAllByRole('img', { name: 'Filter by rating' })[0]).toBeInTheDocument()
  })

  it('names each sort affordance after its column', () => {
    renderTab()
    expect(screen.getAllByRole('img', { name: 'Sort by Date' })[0]).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'Sort by Rating' })[0]).toBeInTheDocument()
  })

  it('sends the chosen ratings to the controller rather than filtering in memory', async () => {
    const { c } = renderTab()

    await openRatingFilter()
    await userEvent.click(await screen.findByRole('menuitem', { name: '5 star' }))
    await userEvent.click(screen.getByRole('button', { name: /^ok$/i }))

    expect(c.applyRatingFilter).toHaveBeenCalledWith([5])
  })

  /** A multi-select filter — the endpoint takes a subset, so several can be chosen. */
  it('allows several ratings at once', async () => {
    const { c } = renderTab()

    await openRatingFilter()
    await userEvent.click(await screen.findByRole('menuitem', { name: '5 star' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: '4 star' }))
    await userEvent.click(screen.getByRole('button', { name: /^ok$/i }))

    expect(c.applyRatingFilter).toHaveBeenCalledWith([5, 4])
  })

  it('reflects the active server-side rating filter in the control', () => {
    renderTab({ ratingFilter: [5] })
    expect(document.querySelector('.ant-table-filter-trigger.active')).toBeInTheDocument()
  })

  /**
   * `scroll={{ x: 'max-content' }}` makes AntD render a hidden measure header as well as
   * the real one, so each title legitimately appears twice; the first is the live one.
   */
  async function clickHeader(label: string) {
    await userEvent.click(screen.getAllByText(label, { selector: '.ant-table-column-title' })[0])
  }

  it('asks the controller to sort when a header is clicked', async () => {
    const { c } = renderTab()

    await clickHeader('Rating')
    await waitFor(() => {
      expect(c.applySort).toHaveBeenCalledWith('rating', 'desc')
    })
  })

  /**
   * The MET-1260 regression. The list defaults to date/descending, and `descend` was the
   * last entry in antd's default direction list — so the first click on Date resolved to
   * antd's cleared state, which reports no `columnKey`, and the click was dropped. No
   * request, no reorder, and no way out: the header stayed descending, so every
   * subsequent click cleared again.
   */
  it('flips the already-sorted Date header instead of dropping the click', async () => {
    const { c } = renderTab({ sortBy: 'date', sortOrder: 'desc' })

    await clickHeader('Date')
    await waitFor(() => {
      expect(c.applySort).toHaveBeenCalledWith('date', 'asc')
    })
  })

  it('flips it back on the next click', async () => {
    const { c } = renderTab({ sortBy: 'date', sortOrder: 'asc' })

    await clickHeader('Date')
    await waitFor(() => {
      expect(c.applySort).toHaveBeenCalledWith('date', 'desc')
    })
  })

  /** Same dead end on the other sortable column, reached one click later. */
  it('flips the already-sorted Rating header too', async () => {
    const { c } = renderTab({ sortBy: 'rating', sortOrder: 'desc' })

    await clickHeader('Rating')
    await waitFor(() => {
      expect(c.applySort).toHaveBeenCalledWith('rating', 'asc')
    })
  })

  it('shows the current sort in the header', () => {
    renderTab({ sortBy: 'rating', sortOrder: 'asc' })
    expect(document.querySelector('.ant-table-column-sort')).toBeInTheDocument()
  })

  it('exposes the sort state as aria-sort, including on the unsorted column', () => {
    renderTab({ sortBy: 'rating', sortOrder: 'asc' })

    const headers = screen.getAllByRole('columnheader')
    const cellFor = (name: string) =>
      headers.find((th) => th.textContent?.startsWith(name)) as HTMLElement

    expect(cellFor('Rating')).toHaveAttribute('aria-sort', 'ascending')
    expect(cellFor('Date')).toHaveAttribute('aria-sort', 'none')
  })
})

describe('ReviewsTab — mobile', () => {
  it('renders cards instead of a table', () => {
    setMobile()
    renderTab()

    expect(document.querySelector('.ant-table')).not.toBeInTheDocument()
    expect(screen.getByText('Sana Khan')).toBeInTheDocument()
  })

  it('offers a sort control, since there are no column headers', async () => {
    setMobile()
    const { c } = renderTab()

    await userEvent.click(screen.getByText('Newest first'))
    await userEvent.click(await screen.findByText('Highest rated'))

    expect(c.applySort).toHaveBeenCalledWith('rating', 'desc')
  })

  it('opens both modals from a card', async () => {
    setMobile()
    const { c } = renderTab({ items: [FULL] })

    await userEvent.click(screen.getByRole('button', { name: /Sana Khan's profile/i }))
    expect(c.openMingler).toHaveBeenCalledWith('m-1')

    await userEvent.click(screen.getByRole('button', { name: 'View booking details' }))
    expect(c.openBooking).toHaveBeenCalledWith('b-1')
  })
})

describe('ReviewsTab — the details modal', () => {
  it('stays closed until a review is opened', () => {
    renderTab()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders the full review, with the modal date format', () => {
    renderTab({
      openReviewId: 'r-1',
      reviewDetail: {
        reviewId: 'r-1',
        mingler: { minglerId: 'm-1', name: 'Sana Khan' },
        interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
        rating: 5,
        date: '15 Apr 2026',
        text: 'The mezze platter and grilled branzino were exceptional.',
        photos: [],
        bookingId: 'b-1',
      },
    })

    const dialog = screen.getByRole('dialog')
    // `DD MMM YYYY` here, `DD-MM-YYYY` in the row — both rendered as sent.
    expect(within(dialog).getByText('15 Apr 2026')).toBeInTheDocument()
    expect(
      within(dialog).getByText('The mezze platter and grilled branzino were exceptional.'),
    ).toBeInTheDocument()
  })

  it('spins while the review loads', () => {
    renderTab({ openReviewId: 'r-1', reviewDetailPending: true })
    expect(document.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows an in-modal alert for a real failure', () => {
    renderTab({
      openReviewId: 'r-1',
      reviewDetailError: true,
      reviewDetailErrorCause: new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL'),
    })

    // Code-mapped copy: a body with no message of its own falls back on the error code,
    // which for anything but a 404 is the generic message.
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  /** AC-02.2 — close-only. */
  it('offers no action but closing', () => {
    renderTab({
      openReviewId: 'r-1',
      reviewDetail: {
        reviewId: 'r-1',
        mingler: { minglerId: 'm-1', name: 'Sana Khan' },
        interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
        rating: 5,
        date: '15 Apr 2026',
        text: 'Lovely.',
        photos: [],
        bookingId: 'b-1',
      },
    })

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByRole('button', { name: /delete|reply|flag/i })).toBeNull()
  })

  /**
   * The photo gallery. It renders `[]` in every environment today because the
   * review-photos bucket is unconfigured, so this is the only place the populated path is
   * exercised — worth keeping precisely because production cannot exercise it yet.
   */
  it('renders the photo gallery when a review has photos', () => {
    renderTab({
      items: [SPARSE],
      openReviewId: 'r-1',
      reviewDetail: {
        reviewId: 'r-1',
        mingler: { minglerId: 'm-1', name: 'Sana Khan' },
        interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
        rating: 5,
        date: '15 Apr 2026',
        text: 'The mezze platter was exceptional.',
        photos: ['https://cdn.mock.local/reviews/a.jpg', 'https://cdn.mock.local/reviews/b.jpg'],
        bookingId: 'b-1',
      },
    })

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getAllByAltText('Photo attached to this review')).toHaveLength(2)
  })

  it('renders no gallery when the review has no photos', () => {
    renderTab({
      items: [SPARSE],
      openReviewId: 'r-1',
      reviewDetail: {
        reviewId: 'r-1',
        mingler: { minglerId: 'm-1', name: 'Sana Khan' },
        interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
        rating: 5,
        date: '15 Apr 2026',
        text: 'Lovely.',
        photos: [],
        bookingId: 'b-1',
      },
    })

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).queryByAltText('Photo attached to this review')).not.toBeInTheDocument()
  })

  /** A deleted Mingler leaves a null name; the modal must not print "null". */
  it('dashes a missing reviewer name', () => {
    renderTab({
      items: [SPARSE],
      openReviewId: 'r-3',
      reviewDetail: {
        reviewId: 'r-3',
        mingler: { minglerId: 'm-3', name: null },
        interestTable: { name: 'Friday Wine Evening', topic: 'Wine & Dine' },
        rating: 5,
        date: '12 Apr 2026',
        text: 'Lovely evening.',
        photos: [],
        bookingId: 'b-3',
      },
    })

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('—')).toBeInTheDocument()
    expect(within(dialog).queryByText(/null/)).not.toBeInTheDocument()
  })

  /** Non-404 failures get the code-mapped copy, not a blanket "failed to load". */
  it("prefers the backend's own message for a detail failure", () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Review service unavailable.' } }
    renderTab({
      items: [SPARSE],
      openReviewId: 'r-1',
      reviewDetailError: true,
      reviewDetailErrorCause: error,
    })

    expect(screen.getByText('Review service unavailable.')).toBeInTheDocument()
  })

  it('handles a rating-only review', () => {
    renderTab({
      // Only the full row behind it, so the modal's copy is the one under test — the
      // sparse row renders the same sentence.
      items: [FULL],
      openReviewId: 'r-5',
      reviewDetail: {
        reviewId: 'r-5',
        mingler: { minglerId: 'm-5', name: 'Yasmeen Iqbal' },
        interestTable: { name: 'Brunch Club', topic: 'Brunch' },
        rating: 4,
        date: '08 Apr 2026',
        text: null,
        photos: [],
        bookingId: 'b-5',
      },
    })

    const dialog = screen.getByRole('dialog')
    expect(
      within(dialog).getByText('This Mingler left a rating without a written review.'),
    ).toBeInTheDocument()
  })
})

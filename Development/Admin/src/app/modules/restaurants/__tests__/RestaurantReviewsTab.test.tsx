import { describe, it, expect, vi, beforeEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantReviewsTab } from '../RestaurantReviewsTab'

const RID = 'rest-1'
const REVIEWS = `/api/v1/restaurants/${RID}/reviews`

function setDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /min-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'rv1',
  date: '15-04-2026',
  minglerId: 'm1',
  minglerName: 'Sana Khan',
  rating: 5,
  bodyPreview: 'Amazing food and ambience.',
  photoUrls: [],
  bookingId: 'BK-10081',
  interestTableId: 'it1',
  interestTableName: 'Sunday Brunch Club',
  restaurantId: RID,
  menuOption: 'Set Menu',
  ...over,
})

function reviewsResponse(items: ReturnType<typeof row>[], total = items.length) {
  return {
    success: true,
    data: {
      summary: {
        average: 4.2,
        total,
        distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': total },
        positive: total,
        neutral: 0,
        negative: 0,
      },
      items,
      pagination: { page: 1, pageSize: 10, totalRecords: total, totalPages: Math.ceil(total / 10) },
    },
  }
}

beforeEach(() => {
  setDesktop()
})

function renderTab(onDelete = vi.fn()) {
  return {
    onDelete,
    ...renderWithProviders(
      <RestaurantReviewsTab restaurantId={RID} onDeleteReviewRequest={onDelete} />,
    ),
  }
}

describe('RestaurantReviewsTab — data loading', () => {
  it('renders the summary card and rows from the API', async () => {
    server.use(http.get(REVIEWS, () => HttpResponse.json(reviewsResponse([row()]))))
    renderTab()
    expect(await screen.findByText('Sana Khan')).toBeInTheDocument()
    expect(screen.getByText('4.2')).toBeInTheDocument()
  })

  it('shows the empty state when the API returns no reviews', async () => {
    server.use(http.get(REVIEWS, () => HttpResponse.json(reviewsResponse([], 0))))
    renderTab()
    expect(await screen.findByText('No reviews yet.')).toBeInTheDocument()
  })

  it('shows an error state when the request fails', async () => {
    server.use(http.get(REVIEWS, () => HttpResponse.json({}, { status: 500 })))
    renderTab()
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument())
  })
})

describe('RestaurantReviewsTab — interactions', () => {
  it('requests deletion via the row action', async () => {
    server.use(http.get(REVIEWS, () => HttpResponse.json(reviewsResponse([row()]))))
    const { onDelete } = renderTab()
    await screen.findByText('Sana Khan')
    const rowEl = screen.getByText('Sana Khan').closest('tr') as HTMLElement
    const actionsCell = rowEl.querySelector('td:last-child') as HTMLElement
    const icons = Array.from(actionsCell.querySelectorAll('div')).filter((d) =>
      Array.from(d.children).some((c) => c.tagName.toLowerCase() === 'svg'),
    )
    // Second icon is the delete action (first is view-booking).
    await userEvent.setup().click(icons[icons.length - 1])
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'rv1' }))
  })

  it('opens the review detail modal fetched from GET /reviews/:id on row click', async () => {
    server.use(
      http.get(REVIEWS, () => HttpResponse.json(reviewsResponse([row()]))),
      http.get('/api/v1/reviews/:id', () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'rv1',
            restaurantName: 'Aurelia',
            minglerName: 'Sana Khan',
            rating: 5,
            body: 'Full review body from the detail endpoint.',
            photoUrls: [],
            date: '15-04-2026',
            bookingId: 'BK-10081',
            interestTableId: 'it1',
            interestTableName: 'Sunday Brunch Club',
            restaurantId: RID,
            menuOption: 'Set Menu',
            questionAnswers: [],
          },
        }),
      ),
    )
    renderTab()
    const user = userEvent.setup()
    const rowEl = (await screen.findByText('Sana Khan')).closest('tr') as HTMLElement
    await user.click(rowEl)
    const dialog = await screen.findByRole('dialog')
    expect(
      await within(dialog).findByText('Full review body from the detail endpoint.'),
    ).toBeInTheDocument()
  })

  it('opens the booking modal fetched from GET /admin/bookings/:id', async () => {
    server.use(
      http.get(REVIEWS, () => HttpResponse.json(reviewsResponse([row()]))),
      http.get('/api/v1/admin/bookings/:id', () =>
        HttpResponse.json({
          success: true,
          data: {
            id: 'BK-10081',
            bookingRef: 'BK-10081',
            interestTableName: 'Sunday Brunch Club',
            topic: 'Brunch',
            restaurantName: 'Aurelia',
            date: '15-04-2026',
            time: '7:30 PM',
            menuOption: 'Set Menu',
            isCrownProMingler: false,
            isTickProMingler: false,
            prominglerLabel: null,
            status: 'CONFIRMED',
            billPkr: 240,
          },
        }),
      ),
    )
    renderTab()
    const user = userEvent.setup()
    const rowEl = (await screen.findByText('Sana Khan')).closest('tr') as HTMLElement
    const actionsCell = rowEl.querySelector('td:last-child') as HTMLElement
    const icons = Array.from(actionsCell.querySelectorAll('div')).filter((d) =>
      Array.from(d.children).some((c) => c.tagName.toLowerCase() === 'svg'),
    )
    await user.click(icons[0])
    expect(await screen.findByText('Booking details')).toBeInTheDocument()
  })

  it('sends the rating filter as a `ratingFilter` query param', async () => {
    let lastSearch = ''
    server.use(
      http.get(REVIEWS, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(reviewsResponse([row()]))
      }),
    )
    renderTab()
    const user = userEvent.setup()
    await screen.findByText('Sana Khan')
    const ratingHeader = screen.getByRole('columnheader', { name: /Rating/ })
    const filterTrigger = within(ratingHeader).getByRole('button', { hidden: true })
    await user.click(filterTrigger)
    await user.click(await screen.findByText('5 Stars'))
    await user.click(screen.getByRole('button', { name: /^OK$/ }))
    await waitFor(() =>
      expect(new URLSearchParams(lastSearch).getAll('ratingFilter')).toContain('5'),
    )
  })

  it('requests page 2 when the page-2 pager item is clicked (BUG-029)', async () => {
    const searches: string[] = []
    server.use(
      http.get(REVIEWS, ({ request }) => {
        const search = new URL(request.url).search
        searches.push(search)
        const page = Number(new URLSearchParams(search).get('page')) || 1
        // 15 records at pageSize 10 -> page 2 genuinely exists. Echo the
        // requested page back so the pager reflects the server's page.
        const res = reviewsResponse([row()], 15)
        res.data.pagination.page = page
        return HttpResponse.json(res)
      }),
    )
    renderTab()
    const user = userEvent.setup()
    await screen.findByText('Sana Khan')

    const pageTwo = document.querySelector('.ant-pagination-item-2') as HTMLElement
    expect(pageTwo).toBeTruthy()
    await user.click(pageTwo)

    await waitFor(() =>
      expect(searches.some((s) => new URLSearchParams(s).get('page') === '2')).toBe(true),
    )
    await waitFor(() =>
      expect(document.querySelector('.ant-pagination-item-active')?.textContent).toBe('2'),
    )
  })

  it('sends sortBy/sortOrder when the Date header is clicked', async () => {
    let lastSearch = ''
    server.use(
      http.get(REVIEWS, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(reviewsResponse([row()]))
      }),
    )
    renderTab()
    const user = userEvent.setup()
    await screen.findByText('Sana Khan')
    await user.click(screen.getByRole('columnheader', { name: /Date/ }))
    await waitFor(() => {
      const params = new URLSearchParams(lastSearch)
      expect(params.get('sortBy')).toBe('date')
      expect(params.get('sortOrder')).toBe('asc')
    })
  })
})

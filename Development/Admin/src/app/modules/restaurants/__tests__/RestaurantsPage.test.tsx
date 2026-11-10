import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantsPage } from '../RestaurantsPage'

const BASE = '/api/v1/restaurants'
const CATEGORIES_ACTIVE = '/api/v1/categories/active'

function setMobile(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: !isMobile && /min-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function beforeEachMobile() {
  beforeEach(() => setMobile(true))
  afterEach(() => setMobile(false))
}

// With `scroll={{ x: 'max-content' }}`, AntD renders a second, `aria-hidden`
// "measure" copy of the header for width calculation, which doubles up
// `.ant-table-filter-trigger` matches — filter it out so indices line up with
// the visible, interactive column order.
function getVisibleFilterTriggers() {
  return Array.from(document.querySelectorAll<HTMLElement>('.ant-table-filter-trigger')).filter(
    (el) => !el.closest('[aria-hidden="true"]'),
  )
}

function mockActiveCategories() {
  server.use(
    http.get(CATEGORIES_ACTIVE, () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [
            { id: 'cat-1', name: 'Premium' },
            { id: 'cat-2', name: 'Standard' },
          ],
        },
      }),
    ),
  )
}

const fixtureItem = {
  id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  name: 'Aurelia',
  cuisine: 'Italian',
  city: 'Karachi',
  category: { id: 'cat-1', name: 'Premium' },
  confirmedBookings: 12,
  joinedAt: '2026-07-01T13:13:15.019Z',
  status: 'ACTIVE',
  visibleOnApp: true,
  avatarUrl: null,
}

const fixtureItemMinimal = {
  id: 'b2c3d4e5-0000-0000-0000-000000000002',
  name: 'Bare Bistro',
  cuisine: null,
  city: null,
  category: null,
  confirmedBookings: 3,
  joinedAt: '2026-06-15T09:00:00.000Z',
  status: 'SUSPENDED',
  visibleOnApp: false,
  avatarUrl: null,
}

function makeList(items: unknown[], overrides: Partial<Record<string, unknown>> = {}) {
  return {
    success: true,
    data: {
      items,
      pagination: {
        page: 1,
        pageSize: 10,
        totalRecords: items.length,
        totalPages: 1,
        ...overrides,
      },
    },
  }
}

describe('RestaurantsPage — real API integration', () => {
  it('renders restaurant rows from the live GET /api/v1/restaurants response', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    renderWithProviders(<RestaurantsPage />)

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Italian')).toBeInTheDocument()
    expect(screen.getByText('Premium')).toBeInTheDocument()
  })

  it('sends page and pageSize as query params', async () => {
    let receivedSearch = ''
    server.use(
      http.get(BASE, ({ request }) => {
        receivedSearch = new URL(request.url).search
        return HttpResponse.json(makeList([fixtureItem]))
      }),
    )
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const params = new URLSearchParams(receivedSearch)
    expect(params.get('page')).toBe('1')
    expect(params.get('pageSize')).toBe('10')
  })

  it('shows a loading state before the response resolves', () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([]))))
    renderWithProviders(<RestaurantsPage />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error message when the request fails', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<RestaurantsPage />)
    await waitFor(() => expect(screen.getByText(/unable to load restaurants/i)).toBeInTheDocument())
  })
})

describe('RestaurantsPage — mapRestaurant fallback fields', () => {
  it('falls back to blank cuisine/city, em-dash category, and undefined avatar', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItemMinimal]))))
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)

    expect(await screen.findByText('Bare Bistro')).toBeInTheDocument()
    expect(screen.getByText('—')).toBeInTheDocument()
    const row = screen.getByText('Bare Bistro').closest('tr')
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('RestaurantsPage — desktop table row navigation', () => {
  it('navigates to /restaurants/:id when a row is clicked', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    mockActiveCategories()
    renderWithProviders(
      <Routes>
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/restaurants/:id" element={<div>Restaurant detail page</div>} />
      </Routes>,
      { route: '/restaurants' },
    )
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const row = screen.getByText('Aurelia').closest('tr')
    expect(row).not.toBeNull()
    await user.click(row as HTMLElement)

    expect(await screen.findByText('Restaurant detail page')).toBeInTheDocument()
  })
})

describe('RestaurantsPage — mobile card list', () => {
  beforeEachMobile()

  it('renders the mobile card list instead of the table when isMobile is true', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)

    await screen.findByText('Aurelia')
    expect(document.querySelector('.restaurant-card-list')).not.toBeNull()
    expect(document.querySelector('.restaurants-table')).toBeNull()
  })

  it('navigates to /restaurants/:id when a card is clicked', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    mockActiveCategories()
    renderWithProviders(
      <Routes>
        <Route path="/restaurants" element={<RestaurantsPage />} />
        <Route path="/restaurants/:id" element={<div>Restaurant detail page</div>} />
      </Routes>,
      { route: '/restaurants' },
    )
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const card = document.querySelector('.restaurant-card')
    expect(card).not.toBeNull()
    await user.click(card as HTMLElement)

    expect(await screen.findByText('Restaurant detail page')).toBeInTheDocument()
  })
})

describe('RestaurantsPage — server-side filtering & sorting', () => {
  it('sends the city search field as a single `cities` string query param and resets to page 1', async () => {
    let lastSearch = ''
    const many = [
      { ...fixtureItem, id: 'r0', name: 'Rest0', city: 'Karachi' },
      { ...fixtureItem, id: 'r1', name: 'Rest1', city: 'Lahore' },
    ]
    server.use(
      http.get(BASE, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(makeList(many))
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Rest0')

    const user = userEvent.setup()
    const filterIcons = getVisibleFilterTriggers()
    const cityFilterIcon = filterIcons[1] // Name(search), City(search), Category, Status
    await user.click(cityFilterIcon)

    const input = await screen.findByPlaceholderText('Search city…')
    await user.type(input, 'Karachi')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    await waitFor(() => {
      const params = new URLSearchParams(lastSearch)
      expect(params.get('cities')).toBe('Karachi')
      expect(params.getAll('cities')).toEqual(['Karachi'])
      expect(params.get('page')).toBe('1')
    })
  })

  // CR-45 AC-2 — `statuses[]` is an allow-list of ACTIVE/SUSPENDED; the API 422s
  // on anything else. This pins the only path in the app that can populate it.
  it('sends only allow-listed values when the Status column filter is applied', async () => {
    let lastSearch = ''
    server.use(
      http.get(BASE, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(makeList([fixtureItem]))
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const statusFilterIcon = getVisibleFilterTriggers()[3] // Name, City, Category, Status
    await user.click(statusFilterIcon)

    const dropdown = await waitFor(() => {
      const el = document.querySelector('.ant-table-filter-dropdown')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })

    // The dropdown must not even offer a value the API would reject.
    expect(within(dropdown).getByText('Active')).toBeInTheDocument()
    expect(within(dropdown).getByText('Suspended')).toBeInTheDocument()
    expect(within(dropdown).queryByText('Pending')).not.toBeInTheDocument()
    expect(within(dropdown).queryByText('Rejected')).not.toBeInTheDocument()

    await user.click(within(dropdown).getByText('Active'))
    await user.click(within(dropdown).getByRole('button', { name: /^ok$/i }))

    await waitFor(() => {
      const params = new URLSearchParams(lastSearch)
      expect(params.getAll('statuses')).toEqual(['ACTIVE'])
      expect(params.get('page')).toBe('1')
    })
  })

  it('sends sortBy/sortOrder query params when a column header is clicked', async () => {
    let lastSearch = ''
    const many = [
      { ...fixtureItem, id: 'r1', name: 'Zeta' },
      { ...fixtureItem, id: 'r2', name: 'Alpha' },
    ]
    server.use(
      http.get(BASE, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(makeList(many))
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Zeta')

    const user = userEvent.setup()
    const nameHeader = screen.getAllByRole('columnheader')[0]
    await user.click(nameHeader)

    await waitFor(() => {
      const params = new URLSearchParams(lastSearch)
      expect(params.get('sortBy')).toBe('name')
      expect(params.get('sortOrder')).toBe('asc')
    })
  })
})

describe('RestaurantsPage — suspend flow', () => {
  it('validates the reason length and confirms suspension via the API, showing a success toast', async () => {
    let status = 'ACTIVE'
    server.use(http.get(BASE, () => HttpResponse.json(makeList([{ ...fixtureItem, status }]))))
    server.use(
      http.post(`${BASE}/:id/suspend`, () => {
        status = 'SUSPENDED'
        return HttpResponse.json({
          success: true,
          data: { id: fixtureItem.id, status: 'SUSPENDED', bookingsCancelled: 0 },
        })
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const row = screen.getByText('Aurelia').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[1])

    const dialog = await screen.findByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: /^suspend$/i })
    expect(confirmBtn).toBeDisabled()

    const textarea = within(dialog).getByPlaceholderText(/enter reason/i)
    await user.type(textarea, 'short')
    expect(confirmBtn).toBeDisabled()

    await user.clear(textarea)
    await user.type(textarea, 'this is a sufficiently long reason')
    expect(confirmBtn).not.toBeDisabled()

    await user.click(confirmBtn)

    expect(await screen.findByText(/aurelia has been suspended/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Suspended')).toBeInTheDocument())
  })

  it('shows an error toast when the suspend API fails', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    server.use(
      http.post(`${BASE}/:id/suspend`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_RESTAURANT_ALREADY_ACTIONED', message: 'Already actioned.' },
          },
          { status: 409 },
        ),
      ),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const row = screen.getByText('Aurelia').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[1])

    const dialog = await screen.findByRole('dialog')
    const textarea = within(dialog).getByPlaceholderText(/enter reason/i)
    await user.type(textarea, 'this is a sufficiently long reason')
    await user.click(within(dialog).getByRole('button', { name: /^suspend$/i }))

    expect(await screen.findByText(/already actioned/i)).toBeInTheDocument()
  })

  it('cancels the suspend modal without changing status', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const row = screen.getByText('Aurelia').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[1])

    const dialog = await screen.findByRole('dialog')
    const textarea = within(dialog).getByPlaceholderText(/enter reason/i)
    await user.type(textarea, 'this reason will be discarded')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(dialog.className).toMatch(/ant-zoom-leave/))
    expect(screen.queryByText(/has been suspended/i)).not.toBeInTheDocument()
  })
})

describe('RestaurantsPage — unsuspend flow', () => {
  it('confirms unsuspension via the API and updates status back to ACTIVE', async () => {
    let status = 'SUSPENDED'
    server.use(
      http.get(BASE, () => HttpResponse.json(makeList([{ ...fixtureItemMinimal, status }]))),
    )
    server.use(
      http.post(`${BASE}/:id/unsuspend`, () => {
        status = 'ACTIVE'
        return HttpResponse.json({
          success: true,
          data: { id: fixtureItemMinimal.id, status: 'ACTIVE' },
        })
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Bare Bistro')

    const user = userEvent.setup()
    const row = screen.getByText('Bare Bistro').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[1])

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^unsuspend$/i }))

    await waitFor(() => expect(screen.getAllByText('Active').length).toBeGreaterThan(0))
  })

  it('cancels the unsuspend modal without changing status', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItemMinimal]))))
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Bare Bistro')

    const user = userEvent.setup()
    const row = screen.getByText('Bare Bistro').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[1])

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(dialog.className).toMatch(/ant-zoom-leave/))
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })
})

describe('RestaurantsPage — change category flow', () => {
  it('changes the category via the API and shows an interpolated success toast', async () => {
    let category = { id: 'cat-1', name: 'Premium' }
    server.use(http.get(BASE, () => HttpResponse.json(makeList([{ ...fixtureItem, category }]))))
    mockActiveCategories()
    server.use(
      http.patch(`${BASE}/:id/category`, () => {
        category = { id: 'cat-2', name: 'Standard' }
        return HttpResponse.json({
          success: true,
          data: { id: fixtureItem.id, category },
        })
      }),
    )
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const row = screen.getByText('Aurelia').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[0])

    const dialog = await screen.findByRole('dialog')
    const select = within(dialog).getByRole('combobox')
    await user.click(select)
    const standardOption = await screen.findAllByText('Standard')
    await user.click(standardOption[standardOption.length - 1])

    const confirmBtn = within(dialog).getByRole('button', { name: /change category/i })
    await user.click(confirmBtn)

    expect(await screen.findByText(/aurelia moved to standard/i)).toBeInTheDocument()
    await waitFor(() => {
      const updatedRow = screen.getByText('Aurelia').closest('tr') as HTMLElement
      expect(within(updatedRow).getByText('Standard')).toBeInTheDocument()
    })
  })

  it('shows a generic error toast when the change-category mutation fails', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    mockActiveCategories()
    server.use(
      http.patch(`${BASE}/:id/category`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_CATEGORY_NOT_FOUND' } },
          { status: 404 },
        ),
      ),
    )
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const row = screen.getByText('Aurelia').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[0])

    const dialog = await screen.findByRole('dialog')
    const select = within(dialog).getByRole('combobox')
    await user.click(select)
    const standardOption = await screen.findAllByText('Standard')
    await user.click(standardOption[standardOption.length - 1])

    await user.click(within(dialog).getByRole('button', { name: /change category/i }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('cancels the change-category modal without mutating', async () => {
    let patchCalled = false
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    mockActiveCategories()
    server.use(
      http.patch(`${BASE}/:id/category`, () => {
        patchCalled = true
        return HttpResponse.json({
          success: true,
          data: { id: fixtureItem.id, category: { id: 'cat-2', name: 'Standard' } },
        })
      }),
    )
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const row = screen.getByText('Aurelia').closest('tr') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const actionTriggers = Array.from(actionCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && d.children.length === 1,
    )
    await user.click(actionTriggers[0])

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(dialog.className).toMatch(/ant-zoom-leave/))
    expect(patchCalled).toBe(false)
    const unchangedRow = screen.getByText('Aurelia').closest('tr') as HTMLElement
    expect(within(unchangedRow).getByText('Premium')).toBeInTheDocument()
  })
})

describe('RestaurantsPage — desktop pagination', () => {
  it('changes the current page via RestaurantsPagination', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...fixtureItem,
      id: `r${i}`,
      name: `Rest${i}`,
    }))
    server.use(
      http.get(BASE, ({ request }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page') ?? '1')
        const start = (page - 1) * 25
        return HttpResponse.json(
          makeList(many.slice(start, start + 25), { totalRecords: 30, totalPages: 2, page }),
        )
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Rest0')

    const user = userEvent.setup()
    const nextPage = document.querySelector('.ant-pagination-next') as HTMLElement
    expect(nextPage).not.toBeNull()
    await user.click(nextPage)

    await waitFor(() => expect(screen.getByText('Rest25')).toBeInTheDocument())
  })

  it('offers 10/25/50 as the page-size options, matching the J10A spec', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList([fixtureItem]))))
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Aurelia')

    const user = userEvent.setup()
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    const dropdown = await waitFor(() => {
      const el = document.querySelector('.ant-select-dropdown')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    expect(within(dropdown).getByText('10 / page')).toBeInTheDocument()
    expect(within(dropdown).getByText('25 / page')).toBeInTheDocument()
    expect(within(dropdown).getByText('50 / page')).toBeInTheDocument()
    expect(within(dropdown).queryByText('20 / page')).not.toBeInTheDocument()
    expect(within(dropdown).queryByText('100 / page')).not.toBeInTheDocument()
  })

  it('changes the page size via RestaurantsPagination, resets to page 1, and renders every row for the chosen size', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...fixtureItem,
      id: `r${i}`,
      name: `Rest${i}`,
    }))
    let lastRequestedPageSize = ''
    server.use(
      http.get(BASE, ({ request }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page') ?? '1')
        const pageSize = Number(url.searchParams.get('pageSize') ?? '10')
        lastRequestedPageSize = url.searchParams.get('pageSize') ?? ''
        const start = (page - 1) * pageSize
        return HttpResponse.json(
          makeList(many.slice(start, start + pageSize), {
            totalRecords: 30,
            totalPages: Math.ceil(30 / pageSize),
            page,
            pageSize,
          }),
        )
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Rest0')
    // Default page size is 10, so only the first 10 rows render initially.
    expect(screen.queryByText('Rest15')).not.toBeInTheDocument()

    const user = userEvent.setup()
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    const opt = await screen.findAllByText('50 / page')
    await user.click(opt[opt.length - 1])

    // 50/page on 30 total records must render every row on a single page —
    // the exact "renders only 10 rows regardless of pageSize" regression.
    await waitFor(() => expect(lastRequestedPageSize).toBe('50'))
    await waitFor(() => expect(screen.getByText('Rest29')).toBeInTheDocument())
    expect(screen.getByText('Rest0')).toBeInTheDocument()
  })
})

describe('RestaurantsPage — mobile pagination', () => {
  beforeEachMobile()

  it('changes the current page via the mobile AntD Pagination control', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...fixtureItem,
      id: `r${i}`,
      name: `Rest${i}`,
    }))
    server.use(
      http.get(BASE, ({ request }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page') ?? '1')
        const start = (page - 1) * 25
        return HttpResponse.json(
          makeList(many.slice(start, start + 25), { totalRecords: 30, totalPages: 2, page }),
        )
      }),
    )
    mockActiveCategories()
    renderWithProviders(<RestaurantsPage />)
    await screen.findByText('Rest0')

    const user = userEvent.setup()
    const nextPage = document.querySelector('.ant-pagination-next') as HTMLElement
    expect(nextPage).not.toBeNull()
    await user.click(nextPage)

    await waitFor(() => expect(screen.getByText('Rest25')).toBeInTheDocument())
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { MinglersPage } from '../MinglersPage'

const items = [
  {
    id: 'm1',
    fullName: 'Sana Khan',
    avatarUrl: null,
    avatarColor: '#0FA79D',
    initials: 'SK',
    phone: '+92 305 111 2222',
    email: 'sana.khan@gmail.com',
    joinedAt: '2024-01-10',
    totalBookings: 28,
    loyaltyPoints: 1240,
    status: 'ACTIVE',
    isPromingler: false,
  },
  {
    id: 'm2',
    fullName: 'Danish Ahmed',
    avatarUrl: null,
    avatarColor: '#FF6B5B',
    initials: 'DA',
    phone: '+92 300 222 3333',
    email: 'danish.ahmed@outlook.com',
    joinedAt: '2024-02-22',
    totalBookings: 14,
    loyaltyPoints: 680,
    status: 'SUSPENDED',
    isPromingler: false,
  },
]

function listResponse(
  data: typeof items,
  overrides: Partial<{
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
  }> = {},
) {
  return HttpResponse.json({
    success: true,
    data: {
      items: data,
      pagination: {
        page: 1,
        pageSize: 25,
        totalItems: data.length,
        totalPages: 1,
        ...overrides,
      },
    },
  })
}

// AntD renders a second, `aria-hidden` "measure" copy of the table header for
// horizontal-scroll width calculation (from `scroll={{ x: 'max-content' }}`),
// which doubles up `.ant-table-filter-trigger` matches — filter it out so
// indices line up with the visible, interactive column order.
function getVisibleFilterTriggers() {
  return Array.from(document.querySelectorAll<HTMLElement>('.ant-table-filter-trigger')).filter(
    (el) => !el.closest('[aria-hidden="true"]'),
  )
}

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

beforeEach(() => {
  server.use(http.get('/api/v1/minglers', () => listResponse(items)))
  setMobile(false)
})

describe('MinglersPage', () => {
  it('renders the mingler directory from the paginated { items, pagination } envelope without crashing', async () => {
    renderWithProviders(<MinglersPage />)
    expect(await screen.findByText('Sana Khan')).toBeInTheDocument()
    expect(screen.getByText('Danish Ahmed')).toBeInTheDocument()
  })

  it('requests statuses as a server-side filter when the status column filter is applied', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return listResponse(items)
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    const user = userEvent.setup()
    // Filter triggers appear in column order (name, phone, email, joined,
    // status) — status is the last one.
    const filterIcons = getVisibleFilterTriggers()
    await user.click(filterIcons[filterIcons.length - 1])
    const dropdown = await waitFor(() => {
      const el = document.querySelector('.ant-table-filter-dropdown')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    await user.click(within(dropdown).getByText('Active'))
    await user.click(within(dropdown).getByRole('button', { name: /^ok$/i }))
    await waitFor(() => expect(capturedUrl?.searchParams.getAll('statuses')).toEqual(['ACTIVE']))
  })

  it('requests a `name` query param when the name column search is confirmed', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return listResponse(items)
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    const user = userEvent.setup()
    const filterIcons = getVisibleFilterTriggers()
    await user.click(filterIcons[0])
    const input = await screen.findByPlaceholderText('Search minglers…')
    await user.type(input, 'sana')
    const searchBtn = screen.getByRole('button', { name: /^search$/i })
    await user.click(searchBtn)
    await waitFor(() => expect(capturedUrl?.searchParams.get('name')).toBe('sana'))
    expect(capturedUrl?.searchParams.has('search')).toBe(false)
    expect(capturedUrl?.searchParams.has('searchField')).toBe(false)
  })

  it('applies name, phone and email filters simultaneously as independent query params', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return listResponse(items)
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    const user = userEvent.setup()

    // Each column's search dropdown stays mounted once opened, so scope the
    // Search button lookup to the dropdown owning the input we just typed into.
    const confirmSearch = async (placeholder: string, value: string) => {
      const input = await screen.findByPlaceholderText(placeholder)
      await user.type(input, value)
      const dropdown = input.closest('.ant-table-filter-dropdown') as HTMLElement
      await user.click(within(dropdown).getByRole('button', { name: /^search$/i }))
    }

    // Name column (index 0)
    await user.click(getVisibleFilterTriggers()[0])
    await confirmSearch('Search minglers…', 'sana')
    await waitFor(() => expect(capturedUrl?.searchParams.get('name')).toBe('sana'))

    // Phone column (index 1) — name must remain set
    await user.click(getVisibleFilterTriggers()[1])
    await confirmSearch('Search phone…', '971')
    await waitFor(() => expect(capturedUrl?.searchParams.get('phone')).toBe('971'))
    expect(capturedUrl?.searchParams.get('name')).toBe('sana')

    // Email column (index 2) — name and phone must remain set
    await user.click(getVisibleFilterTriggers()[2])
    await confirmSearch('Search email…', 'gmail')
    await waitFor(() => expect(capturedUrl?.searchParams.get('email')).toBe('gmail'))
    expect(capturedUrl?.searchParams.get('name')).toBe('sana')
    expect(capturedUrl?.searchParams.get('phone')).toBe('971')
  })

  it('restricts the phone filter to digits and "+" (strips letters/symbols)', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return listResponse(items)
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    const user = userEvent.setup()

    await user.click(getVisibleFilterTriggers()[1])
    const input = (await screen.findByPlaceholderText('Search phone…')) as HTMLInputElement

    // Pure letters are never captured by the field.
    await user.type(input, 'abcXYZ')
    expect(input.value).toBe('')

    // In a mixed string, only digits and a single leading "+" survive.
    await user.type(input, 'abc+123-45xyz')
    expect(input.value).toBe('+12345')

    const dropdown = input.closest('.ant-table-filter-dropdown') as HTMLElement
    await user.click(within(dropdown).getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(capturedUrl?.searchParams.get('phone')).toBe('+12345'))
  })

  it('updates sortBy/sortOrder query params when a sortable column header is clicked', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return listResponse(items)
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    const phoneHeader = headers.find((h) => /phone/i.test(h.textContent ?? ''))
    await user.click(phoneHeader as HTMLElement)
    await waitFor(() => expect(capturedUrl?.searchParams.get('sortBy')).toBe('phone'))
  })

  it('defaults to sorting by joined_at descending on initial load', async () => {
    let capturedUrl: URL | undefined
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return listResponse(items)
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    expect(capturedUrl?.searchParams.get('sortBy')).toBe('joined_at')
    expect(capturedUrl?.searchParams.get('sortOrder')).toBe('desc')
  })

  it('cycles the Joined column sort through cancel, ascending and descending without getting stuck', async () => {
    const capturedUrls: URL[] = []
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrls.push(new URL(request.url))
        return listResponse(items)
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    const user = userEvent.setup()
    const joinedHeader = screen
      .getAllByRole('columnheader')
      .find((h) => /joined/i.test(h.textContent ?? '')) as HTMLElement

    // Initial load is already descending (joined_at/desc) — 1st click is
    // AntD's "descend -> cancel" transition, which must clear sortBy/sortOrder
    // entirely rather than leaving the column stuck on desc.
    await user.click(joinedHeader)
    await waitFor(() => {
      const url = capturedUrls[capturedUrls.length - 1]
      expect(url?.searchParams.has('sortBy')).toBe(false)
      expect(url?.searchParams.has('sortOrder')).toBe(false)
    })

    // 2nd click restarts the cycle at ascending.
    await user.click(joinedHeader)
    await waitFor(() =>
      expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortOrder')).toBe('asc'),
    )
    expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortBy')).toBe('joined_at')

    // 3rd click moves to descending.
    await user.click(joinedHeader)
    await waitFor(() =>
      expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortOrder')).toBe('desc'),
    )
    expect(capturedUrls[capturedUrls.length - 1]?.searchParams.get('sortBy')).toBe('joined_at')
  })

  it('shows an error alert when the request fails', async () => {
    server.use(http.get('/api/v1/minglers', () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<MinglersPage />)
    await waitFor(() => expect(document.querySelector('.ant-alert-error')).not.toBeNull())
  })

  it('changes page via the desktop pagination row', async () => {
    let capturedUrl: URL | undefined
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...items[0],
      id: `m${i}`,
      fullName: `Mingler${i}`,
    }))
    server.use(
      http.get('/api/v1/minglers', ({ request }) => {
        capturedUrl = new URL(request.url)
        return listResponse(many, { totalItems: 30, totalPages: 2 })
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Mingler0')
    const user = userEvent.setup()
    const nextPage = document.querySelector('.minglers-pagination .ant-pagination-next')
    expect(nextPage).not.toBeNull()
    await user.click(nextPage as HTMLElement)
    await waitFor(() => expect(capturedUrl?.searchParams.get('page')).toBe('2'))
  })

  it('shows the Pro Mingler badge in the name column only for prominglers', async () => {
    server.use(
      http.get('/api/v1/minglers', () =>
        listResponse([
          { ...items[0], isPromingler: true },
          { ...items[1], isPromingler: false },
        ]),
      ),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    // Exactly one row (Sana) is a promingler, so the badge appears once.
    expect(screen.getAllByText('Pro Mingler')).toHaveLength(1)
  })

  it('shows the Pro Mingler badge on mobile cards for prominglers', async () => {
    setMobile(true)
    server.use(
      http.get('/api/v1/minglers', () => listResponse([{ ...items[0], isPromingler: true }])),
    )
    renderWithProviders(<MinglersPage />)
    expect(await screen.findByText('Pro Mingler')).toBeInTheDocument()
  })

  it('renders the mobile card list with the API field names', async () => {
    setMobile(true)
    renderWithProviders(<MinglersPage />)
    expect(await screen.findByText('Sana Khan')).toBeInTheDocument()
    expect(screen.getByText('+92 305 111 2222')).toBeInTheDocument()
    expect(screen.getByText('1,240')).toBeInTheDocument()
  })

  it('suspends a mingler via the real POST endpoint after confirming the suspend modal', async () => {
    let capturedBody: unknown
    server.use(
      http.get('/api/v1/minglers/m1/bookings/count-active', () =>
        HttpResponse.json({ success: true, data: { count: 0 } }),
      ),
      http.post('/api/v1/minglers/m1/suspend', async ({ request }) => {
        capturedBody = await request.json()
        return HttpResponse.json({
          success: true,
          data: {
            id: 'm1',
            status: 'SUSPENDED',
            suspendedAt: '2026-07-08T13:50:33.529Z',
            suspendedReason: (capturedBody as { reason: string }).reason,
            bookingsCancelled: 0,
          },
        })
      }),
    )
    renderWithProviders(<MinglersPage />)
    await screen.findByText('Sana Khan')
    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    // Sana Khan (row 0) is ACTIVE, so the actions cell renders only the
    // suspend icon — click its containing (onClick-bearing) div directly.
    const suspendIcon = rows[0].querySelector('td:last-child svg')
    await user.click(suspendIcon?.parentElement as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    const textarea = within(dialog).getByRole('textbox')
    await user.type(textarea, 'Violation of community guidelines')
    const confirmBtn = within(dialog).getByRole('button', { name: /confirm suspend/i })
    await user.click(confirmBtn)
    await waitFor(() => expect(screen.getByText(/has been suspended/i)).toBeInTheDocument())
    expect(capturedBody).toEqual({ reason: 'Violation of community guidelines' })
  })
})

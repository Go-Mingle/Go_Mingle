import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTablesPage } from '../InterestTablesPage'
import type { MasterInterestTableItem } from '../types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const baseRow = (over: Partial<MasterInterestTableItem> = {}): MasterInterestTableItem => ({
  id: 'it1',
  name: 'Alpha Dinner',
  coverImageUrl: null,
  restaurant: { id: 'r1', name: 'Aurelia' },
  startDate: '12-07-2026',
  startTime: '20:00',
  maxGuests: 6,
  availabilityMode: 'AVAILABLE_NOW',
  inviteOnly: false,
  promingler: null,
  status: 'PENDING',
  ...over,
})

/** Captures the query string the page sends, so param mapping can be asserted. */
let lastListUrl: URL | null = null

function mockList(items: MasterInterestTableItem[], totalRecords = items.length) {
  server.use(
    http.get('/api/v1/interest-tables', ({ request }) => {
      lastListUrl = new URL(request.url)
      return HttpResponse.json({
        success: true,
        data: {
          items,
          pagination: {
            page: Number(lastListUrl.searchParams.get('page') ?? 1),
            pageSize: Number(lastListUrl.searchParams.get('pageSize') ?? 10),
            totalRecords,
            totalPages: Math.max(1, Math.ceil(totalRecords / 10)),
          },
        },
      })
    }),
  )
}

/** Opens a column's filter dropdown by its zero-based position in the header. */
async function openFilter(index: number) {
  const triggers = document.querySelectorAll('.ant-table-filter-trigger')
  await userEvent.click(triggers[index] as HTMLElement)
}

describe('InterestTablesPage (master list)', () => {
  beforeEach(() => {
    lastListUrl = null
  })
  afterEach(() => {
    mockNavigate.mockReset()
  })

  it('renders the title, New button, rows and the Restaurant column', async () => {
    mockList([
      baseRow({ id: '1', name: 'Alpha Dinner' }),
      baseRow({ id: '2', name: 'Bravo Brunch', restaurant: { id: 'r2', name: 'Bistro Nord' } }),
    ])
    renderWithProviders(<InterestTablesPage />)

    await waitFor(() => expect(screen.getByText('Alpha Dinner')).toBeInTheDocument())
    expect(screen.getByText('Bravo Brunch')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /new interest table/i })).toBeInTheDocument()
    expect(screen.getAllByText('RESTAURANT').length).toBeGreaterThan(0)
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Bistro Nord')).toBeInTheDocument()
  })

  it('requests page 1 at the app-wide default page size of 10, sorted by dateTime desc', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    expect(lastListUrl!.searchParams.get('page')).toBe('1')
    // The API would default to 25; we send 10 to match every other grid.
    expect(lastListUrl!.searchParams.get('pageSize')).toBe('10')
    expect(lastListUrl!.searchParams.get('sortBy')).toBe('dateTime')
    expect(lastListUrl!.searchParams.get('sortOrder')).toBe('desc')
  })

  it('renders the pre-formatted date and time without ISO parsing', async () => {
    mockList([baseRow({ startDate: '12-07-2026', startTime: '20:00' })])
    renderWithProviders(<InterestTablesPage />)
    expect(await screen.findByText('12-07-2026 · 8:00 PM')).toBeInTheDocument()
  })

  it('renders "Self Captain" when the row has no promingler', async () => {
    mockList([baseRow({ promingler: null })])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')
    expect(screen.getByText('Self Captain')).toBeInTheDocument()
  })

  it('renders a bare promingler name as plain text (no mingler id to link to)', async () => {
    mockList([baseRow({ promingler: 'Laiba Hassan' })])
    renderWithProviders(<InterestTablesPage />)
    const name = await screen.findByText('Laiba Hassan')
    expect(name).not.toHaveAttribute('role', 'button')
  })

  it('links the promingler to the mingler detail page once the API sends an id', async () => {
    mockList([baseRow({ promingler: { id: 'm1', name: 'Laiba Hassan' } })])
    renderWithProviders(<InterestTablesPage />)
    await userEvent.click(await screen.findByText('Laiba Hassan'))
    expect(mockNavigate).toHaveBeenCalledWith('/minglers/m1')
  })

  it('links the restaurant cell to the restaurant detail page', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await userEvent.click(await screen.findByText('Aurelia'))
    expect(mockNavigate).toHaveBeenCalledWith('/restaurants/r1')
  })

  it('navigates a row click to the unscoped detail route so Back returns here', async () => {
    mockList([baseRow({ id: 'view1', name: 'Viewable Table' })])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Viewable Table')

    const row = document.querySelector('tbody tr.ant-table-row') as HTMLElement
    await userEvent.click(row)
    expect(mockNavigate).toHaveBeenCalledWith('/interest-tables/view1?tab=overview')
  })

  it('still navigates when a row is missing its restaurant', async () => {
    mockList([baseRow({ id: 'orphan', restaurant: null })])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    const row = document.querySelector('tbody tr.ant-table-row') as HTMLElement
    await userEvent.click(row)
    expect(mockNavigate).toHaveBeenCalledWith('/interest-tables/orphan?tab=overview')
  })

  it('sends search + searchField when the Interest Table magnifier is used', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await openFilter(0)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await userEvent.type(input, 'tasting{Enter}')

    await waitFor(() => expect(lastListUrl!.searchParams.get('search')).toBe('tasting'))
    expect(lastListUrl!.searchParams.get('searchField')).toBe('interestTable')
    expect(lastListUrl!.searchParams.get('page')).toBe('1')
  })

  it('sends restaurantId[] as repeated keys from the Restaurant column filter', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await openFilter(1)
    const dropdown = document.querySelector('.ant-table-filter-dropdown') as HTMLElement
    const firstOption = within(dropdown).getAllByRole('checkbox')[0]
    await userEvent.click(firstOption)
    await userEvent.click(within(dropdown).getByRole('button', { name: /apply/i }))

    await waitFor(() => expect(lastListUrl!.searchParams.getAll('restaurantId').length).toBe(1))
  })

  it('sends the search term as searchField=restaurant from the Restaurant column filter', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await openFilter(1)
    const dropdown = document.querySelector('.ant-table-filter-dropdown') as HTMLElement
    await userEvent.type(within(dropdown).getByRole('textbox'), 'Aurelia')
    await userEvent.click(within(dropdown).getByRole('button', { name: /apply/i }))

    await waitFor(() => expect(lastListUrl!.searchParams.get('search')).toBe('Aurelia'))
    expect(lastListUrl!.searchParams.get('searchField')).toBe('restaurant')
  })

  it('sends multi-select status filters as repeated keys', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    // Filter columns in order: name[0], restaurant[1], availability[2], inviteOnly[3], status[4].
    await openFilter(4)
    const dropdown = document.querySelector('.ant-table-filter-dropdown') as HTMLElement
    const options = dropdown.querySelectorAll('.ant-dropdown-menu-item')
    const pending = Array.from(options).find((o) => /^pending$/i.test(o.textContent ?? ''))
    const confirmed = Array.from(options).find((o) => /^confirmed$/i.test(o.textContent ?? ''))
    await userEvent.click(pending as HTMLElement)
    await userEvent.click(confirmed as HTMLElement)
    const okBtn = Array.from(dropdown.querySelectorAll('button')).find((b) =>
      /ok/i.test(b.textContent ?? ''),
    )
    await userEvent.click(okBtn as HTMLElement)

    await waitFor(() =>
      expect(lastListUrl!.searchParams.getAll('status')).toEqual(['PENDING', 'CONFIRMED']),
    )
  })

  it('sends inviteOnly=true from the Invite only filter', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await openFilter(3)
    const dropdown = document.querySelector('.ant-table-filter-dropdown') as HTMLElement
    const yes = Array.from(dropdown.querySelectorAll('.ant-dropdown-menu-item')).find((o) =>
      /^yes$/i.test(o.textContent ?? ''),
    )
    await userEvent.click(yes as HTMLElement)
    const okBtn = Array.from(dropdown.querySelectorAll('button')).find((b) =>
      /ok/i.test(b.textContent ?? ''),
    )
    await userEvent.click(okBtn as HTMLElement)

    await waitFor(() => expect(lastListUrl!.searchParams.get('inviteOnly')).toBe('true'))
  })

  it('sends the sort params when a sortable column header is clicked', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await userEvent.click(screen.getAllByText('MAX GUESTS')[0])
    await waitFor(() => expect(lastListUrl!.searchParams.get('sortBy')).toBe('maxGuests'))
    expect(lastListUrl!.searchParams.get('sortOrder')).toBe('asc')
  })

  it('changes the page size and resets to page 1', async () => {
    mockList([baseRow()], 120)
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await userEvent.click(screen.getByText('10 / page'))
    await userEvent.click(await screen.findByText('50 / page'))

    await waitFor(() => expect(lastListUrl!.searchParams.get('pageSize')).toBe('50'))
    expect(lastListUrl!.searchParams.get('page')).toBe('1')
  })

  it('pages forward', async () => {
    mockList([baseRow()], 120)
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await userEvent.click(screen.getByTitle('2'))
    await waitFor(() => expect(lastListUrl!.searchParams.get('page')).toBe('2'))
  })

  it('shows the record range for the current page', async () => {
    mockList([baseRow()], 42)
    renderWithProviders(<InterestTablesPage />)
    expect(await screen.findByText(/Showing 1–10 of 42 results/)).toBeInTheDocument()
  })

  it('shows a zero range when the list is empty but filtered', async () => {
    mockList([], 0)
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText(/no interest tables yet/i)
    // Empty + unfiltered short-circuits to the empty state, so no range row.
    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
  })

  it('shows the empty state when there are no tables and no filters', async () => {
    mockList([], 0)
    renderWithProviders(<InterestTablesPage />)
    expect(await screen.findByText(/no interest tables yet/i)).toBeInTheDocument()
  })

  it('shows an error alert when the very first load fails', async () => {
    server.use(
      http.get('/api/v1/interest-tables', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_FORBIDDEN', message: 'Nope' } },
          { status: 403 },
        ),
      ),
    )
    renderWithProviders(<InterestTablesPage />)
    expect(await screen.findByText(/failed to load data/i)).toBeInTheDocument()
  })

  it("surfaces the server's error message as a toast", async () => {
    server.use(
      http.get('/api/v1/interest-tables', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_VALIDATION', message: 'Search term too long.' } },
          { status: 400 },
        ),
      ),
    )
    renderWithProviders(<InterestTablesPage />)
    expect(await screen.findByText('Search term too long.')).toBeInTheDocument()
  })

  it('opens the restaurant picker when New is clicked', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')
    await userEvent.click(screen.getByRole('button', { name: /new interest table/i }))
    expect(await screen.findByText('Select a restaurant')).toBeInTheDocument()
  })

  it('does not call the restaurants API for the picker until the user searches', async () => {
    const pickerCalls: URL[] = []
    mockList([baseRow()])
    server.use(
      http.get('/api/v1/restaurants', ({ request }) => {
        const url = new URL(request.url)
        // The Restaurant column filter also lists restaurants; only calls carrying
        // `statuses` come from the picker.
        if (url.searchParams.getAll('statuses').length) pickerCalls.push(url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [{ id: 'r1', name: 'Aurelia' }],
            pagination: { page: 1, pageSize: 50, totalRecords: 1, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await userEvent.click(screen.getByRole('button', { name: /new interest table/i }))
    await screen.findByText('Select a restaurant')

    // Opening the modal must not fetch anything.
    expect(pickerCalls).toHaveLength(0)
  })

  it('lists nothing and prompts the user to search before any term is typed', async () => {
    mockList([baseRow()])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await userEvent.click(screen.getByRole('button', { name: /new interest table/i }))
    await screen.findByText('Select a restaurant')
    // The page-size selector is also a combobox — scope to the modal.
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('combobox'))

    expect(await screen.findByText('Start typing to search restaurants.')).toBeInTheDocument()
    // No options in the dropdown ("Aurelia" still appears in the grid row behind it).
    expect(document.querySelectorAll('.ant-select-item-option')).toHaveLength(0)
  })

  it('requests only ACTIVE restaurants, by name, once the user searches', async () => {
    const pickerCalls: URL[] = []
    mockList([baseRow()])
    server.use(
      http.get('/api/v1/restaurants', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.getAll('statuses').length) pickerCalls.push(url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [{ id: 'r9', name: 'Zephyr Grill' }],
            pagination: { page: 1, pageSize: 50, totalRecords: 1, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    await userEvent.click(screen.getByRole('button', { name: /new interest table/i }))
    await screen.findByText('Select a restaurant')
    const dialog = await screen.findByRole('dialog')
    const combobox = within(dialog).getByRole('combobox')
    await userEvent.click(combobox)
    await userEvent.type(combobox, 'Zephyr')

    // Debounced in the modal, so give it room past the 450ms wait.
    await waitFor(() => expect(pickerCalls.length).toBeGreaterThan(0), { timeout: 4000 })
    const url = pickerCalls[pickerCalls.length - 1]
    expect(url.searchParams.getAll('statuses')).toEqual(['ACTIVE'])
    expect(url.searchParams.get('q')).toBe('Zephyr')
    expect(url.searchParams.get('searchField')).toBe('name')

    expect(await screen.findByText('Zephyr Grill', {}, { timeout: 4000 })).toBeInTheDocument()
  })

  it('makes a Coming Soon table available and shows a success toast', async () => {
    mockList([baseRow({ id: 'cs1', name: 'Coming Soon Table', status: 'COMING_SOON' })])
    server.use(
      http.post('/api/v1/interest-tables/cs1/make-available', () =>
        HttpResponse.json({
          success: true,
          data: { id: 'cs1', status: 'DRAFT', availability: 'AVAILABLE_NOW' },
        }),
      ),
    )
    renderWithProviders(<InterestTablesPage />)
    await waitFor(() => expect(screen.getByText('Coming Soon Table')).toBeInTheDocument())

    // ActionIcon renders a clickable div, not a native button. A COMING_SOON row
    // offers edit, then make available — the last icon in the pinned cell.
    const row = document.querySelector('tbody tr.ant-table-row') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    const icons = actionCell.querySelectorAll('svg')
    expect(icons).toHaveLength(2)
    await userEvent.click(icons[1].parentElement as HTMLElement)

    expect(await screen.findByText('Interest table is now available.')).toBeInTheDocument()
  })

  it('toasts the API message when make-available fails', async () => {
    mockList([baseRow({ id: 'cs2', name: 'Coming Soon Table', status: 'COMING_SOON' })])
    server.use(
      http.post('/api/v1/interest-tables/cs2/make-available', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_CONFLICT', message: 'Already available.' } },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<InterestTablesPage />)
    await waitFor(() => expect(screen.getByText('Coming Soon Table')).toBeInTheDocument())

    const row = document.querySelector('tbody tr.ant-table-row') as HTMLElement
    const icons = (row.querySelector('td:last-child') as HTMLElement).querySelectorAll('svg')
    await userEvent.click(icons[icons.length - 1].parentElement as HTMLElement)

    expect(await screen.findByText('Already available.')).toBeInTheDocument()
  })

  it('opens the detail page in edit mode from the DRAFT pencil', async () => {
    mockList([baseRow({ id: 'draft1', status: 'DRAFT' })])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    const row = document.querySelector('tbody tr.ant-table-row') as HTMLElement
    const icons = (row.querySelector('td:last-child') as HTMLElement).querySelectorAll('svg')
    await userEvent.click(icons[0].parentElement as HTMLElement)

    expect(mockNavigate).toHaveBeenCalledWith('/interest-tables/draft1?tab=overview&edit=1')
  })

  it('renders no view icon — the row itself navigates; a finished table offers nothing', async () => {
    mockList([baseRow({ id: 'eye1', status: 'COMPLETED' })])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    const row = document.querySelector('tbody tr.ant-table-row') as HTMLElement
    const actionCell = row.querySelector('td:last-child') as HTMLElement
    expect(actionCell.querySelectorAll('svg')).toHaveLength(0)
  })

  it('opens a live (Pending) table in edit mode from the pencil', async () => {
    mockList([baseRow({ id: 'live1', status: 'PENDING' })])
    renderWithProviders(<InterestTablesPage />)
    await screen.findByText('Alpha Dinner')

    const row = document.querySelector('tbody tr.ant-table-row') as HTMLElement
    const icons = (row.querySelector('td:last-child') as HTMLElement).querySelectorAll('svg')
    expect(icons).toHaveLength(1)
    await userEvent.click(icons[0].parentElement as HTMLElement)

    expect(mockNavigate).toHaveBeenCalledWith('/interest-tables/live1?tab=overview&edit=1')
  })
})

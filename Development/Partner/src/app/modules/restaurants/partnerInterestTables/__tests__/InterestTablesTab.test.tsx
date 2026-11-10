import { describe, it, expect, vi, afterEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { InterestTablesTab } from '../components/InterestTablesTab'
import type { useInterestTablesTab } from '../hooks/useInterestTablesTab'
import type { InterestTableListItem } from '../types'

type Controller = ReturnType<typeof useInterestTablesTab>

const navigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigate }
})

const CONFIRMED: InterestTableListItem = {
  interestTableId: 'it-1',
  name: 'Friday Wine Evening',
  imageUrl: 'https://cdn.gomingle.com/it-1.jpg',
  date: '28-04-2026',
  time: '7:00 PM',
  maxGuests: 8,
  availabilityMode: 'AVAILABLE_NOW',
  inviteOnly: true,
  seatsBooked: 5,
  proMingler: { name: 'Sana Khan', kind: 'ADMIN_ASSIGNED' },
  status: 'CONFIRMED',
}

const SOON: InterestTableListItem = {
  interestTableId: 'it-soon',
  name: "Chef's Counter Tasting",
  imageUrl: null,
  date: '18-06-2026',
  time: '8:00 PM',
  maxGuests: 8,
  availabilityMode: 'COMING_SOON',
  inviteOnly: false,
  seatsBooked: 0,
  proMingler: { name: '', kind: 'NONE' },
  status: 'COMING_SOON',
}

const SELF: InterestTableListItem = {
  ...SOON,
  interestTableId: 'it-open',
  name: 'Sunday Brunch Social',
  status: 'PENDING',
  proMingler: { name: 'Osama Hashmi', kind: 'SELF_CLAIMED' },
}

function controller(overrides: Partial<Controller> = {}): Controller {
  return {
    items: [CONFIRMED, SOON, SELF],
    total: 3,
    page: 1,
    pageSize: 10,
    status: undefined,
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    changePage: vi.fn(),
    changePageSize: vi.fn(),
    applyStatus: vi.fn(),
    ...overrides,
  } as Controller
}

function renderTab(overrides: Partial<Controller> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<InterestTablesTab c={c} />) }
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
  navigate.mockClear()
})

describe('InterestTablesTab — states', () => {
  it('spins while the grid loads', () => {
    const { container } = renderTab({ isPending: true })

    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it("shows the backend's own message on failure", () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Interest tables unavailable.' } }
    renderTab({ isError: true, error })

    expect(screen.getByText('Interest tables unavailable.')).toBeInTheDocument()
  })

  it('distinguishes an empty restaurant from an empty filter result', () => {
    const { unmount } = renderTab({ items: [], total: 0 })
    expect(screen.getByText('No interest tables yet')).toBeInTheDocument()
    unmount()

    renderTab({ items: [], total: 0, status: 'COMPLETED' })
    expect(screen.getByText('No interest tables with this status')).toBeInTheDocument()
  })

  it('keeps the status filter reachable when the filter matches nothing', () => {
    // The no-match copy tells the partner to clear the filter, so the control it
    // refers to has to still be on screen — it rides in as the grid's empty body
    // rather than replacing the grid (MET-1259).
    renderTab({ items: [], total: 0, status: 'COMPLETED' })

    expect(screen.getByText('No interest tables with this status')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter by Status' })).toBeInTheDocument()
  })

  it('hides the pagination when nothing matched — there are no pages to walk', () => {
    renderTab({ items: [], total: 0, status: 'COMPLETED' })

    expect(screen.queryByText('10 / page')).not.toBeInTheDocument()
  })

  it('offers no filter on a restaurant that has no interest tables at all', () => {
    renderTab({ items: [], total: 0 })

    expect(screen.queryByRole('button', { name: /filter/i })).not.toBeInTheDocument()
  })
})

describe('InterestTablesTab — the grid is read-only', () => {
  it('offers no create, edit or cancel affordance (BR-02)', () => {
    renderTab()

    expect(
      screen.queryByRole('button', { name: /add|create|new interest table/i }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /make available/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /delete|publish/i })).not.toBeInTheDocument()
  })

  it('shows no restaurant column — the partner is already scoped to one', () => {
    renderTab()

    expect(screen.queryByRole('columnheader', { name: /restaurant/i })).not.toBeInTheDocument()
  })

  it('renders a row per table with its name and status', () => {
    renderTab()

    expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    // Three times over: one status badge, plus the availability mode on the two rows
    // that carry it — the same label legitimately serves both columns.
    expect(screen.getAllByText('Coming Soon')).toHaveLength(3)
  })

  it('renders the pre-formatted date and time verbatim', () => {
    renderTab()

    // Not through dayjs — that would print "Invalid Date" for DD-MM-YYYY.
    expect(screen.getByText(/28-04-2026 · 7:00 PM/)).toBeInTheDocument()
  })

  it('renders seats booked over max', () => {
    renderTab()

    expect(screen.getByText('5 / 8')).toBeInTheDocument()
  })

  it('title-cases the availability mode', () => {
    renderTab()

    expect(screen.getByText('Available Now')).toBeInTheDocument()
    expect(screen.getAllByText('Coming Soon').length).toBeGreaterThan(0)
  })

  it('badges the Invite Only table', () => {
    renderTab()

    expect(screen.getAllByText('Invite Only')).toHaveLength(1)
  })

  it('shows a Pro Mingler name for both kinds, and a dash for none', () => {
    renderTab()

    expect(screen.getByText('Sana Khan')).toBeInTheDocument()
    expect(screen.getByText('Osama Hashmi')).toBeInTheDocument()
    // The NONE row renders an em dash instead.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('offers exactly the five visible statuses as filters — never Draft', async () => {
    renderTab()

    await userEvent.click(screen.getByRole('button', { name: /filter/i }))

    for (const label of ['Pending', 'Coming Soon', 'Confirmed', 'Completed', 'Cancelled']) {
      expect(await screen.findByRole('menuitem', { name: label })).toBeInTheDocument()
    }
    // Draft is not a partner-visible status (BR-03).
    expect(screen.queryByRole('menuitem', { name: /draft/i })).not.toBeInTheDocument()
  })

  it('sends the chosen status to the controller, not an in-memory filter', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getByRole('button', { name: /filter/i }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Completed' }))
    await userEvent.click(screen.getByRole('button', { name: /^ok$/i }))

    expect(c.applyStatus).toHaveBeenCalledWith(['COMPLETED'])
  })

  it('reflects the active server-side filter in the control', () => {
    renderTab({ status: 'CONFIRMED' })

    // `filteredValue` is driven by the request, so the header shows it as active.
    expect(document.querySelector('.ant-table-filter-trigger.active')).toBeInTheDocument()
  })

  it('names the status filter trigger after its column, not just "filter"', () => {
    // MET-1259: AntD's own glyph announced the grid's only filter as the bare
    // "filter", so it read as a decoration and was reported as absent.
    renderTab()

    expect(screen.getByRole('button', { name: 'Filter by Status' })).toBeInTheDocument()
    expect(document.querySelector('.ant-table-column-status-filter')).toBeInTheDocument()
    // Phosphor only — AntD's `anticon-filter` must not come back with it.
    expect(document.querySelector('.anticon-filter')).not.toBeInTheDocument()
  })
})

describe('InterestTablesTab — the mobile status filter (MET-1259)', () => {
  /**
   * AntD's Select opens on mousedown, not click, and returns the *visible* options —
   * `role="option"` also matches rc-select's hidden screen-reader list, which carries
   * raw values and only the first couple of them.
   */
  const openStatusFilter = async () => {
    fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Filter by Status' }))
    await screen.findByText('Completed')
    return Array.from(document.querySelectorAll('.ant-select-item-option-content')).map(
      (option) => option.textContent,
    )
  }

  it('offers exactly the five visible statuses above the card list — never Draft', async () => {
    setMobile()
    renderTab()

    // "All statuses" is the unfiltered state, carried by the placeholder.
    expect(screen.getByText('All statuses')).toBeInTheDocument()

    // Draft is not a partner-visible status (BR-03), so it is not one of the five.
    expect(await openStatusFilter()).toEqual([
      'Pending',
      'Coming Soon',
      'Confirmed',
      'Completed',
      'Cancelled',
    ])
  })

  it('sends the chosen status to the controller', async () => {
    setMobile()
    const { c } = renderTab()

    await openStatusFilter()
    // Not a status any card on screen carries, so this is the option and nothing else.
    fireEvent.click(screen.getByText('Completed'))

    expect(c.applyStatus).toHaveBeenCalledWith('COMPLETED')
  })

  it('clears back to all statuses', async () => {
    setMobile()
    const { c } = renderTab({ status: 'COMPLETED' })

    await userEvent.click(document.querySelector('.ant-select-clear') as HTMLElement)

    expect(c.applyStatus).toHaveBeenCalledWith(undefined)
  })

  it('keeps the filter on screen when it matches nothing', () => {
    setMobile()
    renderTab({ items: [], total: 0, status: 'COMPLETED' })

    expect(screen.getByRole('combobox', { name: 'Filter by Status' })).toBeInTheDocument()
    expect(screen.getByText('No interest tables with this status')).toBeInTheDocument()
  })

  it('offers no filter on a restaurant with no interest tables at all', () => {
    setMobile()
    renderTab({ items: [], total: 0 })

    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  })
})

describe('InterestTablesTab — navigation', () => {
  it('opens the detail page for the clicked table', async () => {
    renderTab()

    await userEvent.click(screen.getByText('Friday Wine Evening'))

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-1')
  })

  it('opens the detail page from a mobile card', async () => {
    setMobile()
    renderTab()

    await userEvent.click(screen.getByText('Sunday Brunch Social'))

    expect(navigate).toHaveBeenCalledWith('/interest-tables/it-open')
  })
})

describe('InterestTablesTab — paging', () => {
  it('reports the server total, not the row count', () => {
    // 3 rows on screen but 42 in total: the pagination must trust the server.
    renderTab({ total: 42 })

    expect(screen.getByText(/42/)).toBeInTheDocument()
  })

  it('offers only page sizes the params layer accepts', async () => {
    renderTab({ total: 420 })

    // The shared control's dropdown is built from the users options, so J6F accepts
    // the same set — otherwise picking one would be silently dropped.
    await userEvent.click(screen.getByText('10 / page'))
    for (const size of ['25 / page', '50 / page', '100 / page']) {
      expect(await screen.findByText(size)).toBeInTheDocument()
    }
  })

  it('asks the controller to change page size', async () => {
    const { c } = renderTab({ total: 420 })

    await userEvent.click(screen.getByText('10 / page'))
    await userEvent.click(await screen.findByText('25 / page'))

    expect(c.changePageSize).toHaveBeenCalledWith(25)
  })

  it('asks the controller to change page', async () => {
    const { c } = renderTab({ total: 42 })

    await userEvent.click(screen.getByTitle('2'))

    // AntD passes (page, pageSize); only the page matters to the controller.
    expect(c.changePage).toHaveBeenCalled()
    expect(vi.mocked(c.changePage).mock.calls[0][0]).toBe(2)
  })
})

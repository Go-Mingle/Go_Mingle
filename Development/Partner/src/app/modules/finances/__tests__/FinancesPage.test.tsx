import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { clearMockFinances, resetMockFinances } from '../../../../mocks/data/partnerFinances'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { FINANCES_ENDPOINTS } from '../constants'
import { FinancesPage } from '../FinancesPage'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return { ...actual, useNavigate: () => navigateMock }
})

function setDesktop(isDesktop = true) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: isDesktop && /min-width/.test(query),
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

async function renderPage(route = '/finances') {
  renderWithProviders(<FinancesPage />, { route })
  await screen.findByRole('heading', { name: /finances/i })
}

/**
 * Minglers and interest tables repeat across rows — Sana Khan appears on two
 * bookings — so cell queries are scoped by the one unique value per row, the
 * booking reference.
 */
function rowFor(bookingRef: string): HTMLElement {
  return screen.getByText(bookingRef).closest('tr') as HTMLElement
}

beforeEach(() => {
  resetMockFinances()
  navigateMock.mockClear()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  setDesktop()
})

describe('FinancesPage states', () => {
  it('spins while the ledger loads', () => {
    const { container } = renderWithProviders(<FinancesPage />)
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message when the ledger fails', async () => {
    server.use(
      http.get(FINANCES_ENDPOINTS.ledger, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Ledger unavailable.' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<FinancesPage />)
    expect(await screen.findByText('Ledger unavailable.')).toBeInTheDocument()
  })

  /** A normal 200 with no rows — never an error (AC-06.2). */
  it('shows the empty state with the spec copy', async () => {
    clearMockFinances()
    await renderPage()
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument()
  })
})

/**
 * A filter that matched nothing and a restaurant with no completed bookings are
 * different situations with different remedies, so they get different copy — and
 * the no-match one must not take the filter down with the rows (MET-1301).
 */
describe('FinancesPage empty states', () => {
  it('drops the grid only when nothing is filtered', async () => {
    clearMockFinances()
    await renderPage()

    expect(await screen.findByText('No transactions yet')).toBeInTheDocument()
    expect(screen.getByText(/once a booking is completed/i)).toBeInTheDocument()
    expect(document.querySelector('.ant-table')).not.toBeInTheDocument()
    // "Showing 0–0 of 0" under an empty grid is noise, not information.
    expect(screen.queryByText(/of 0 results/i)).not.toBeInTheDocument()
  })

  it('treats a sort on its own as unfiltered — it reorders, it never removes', async () => {
    clearMockFinances()
    await renderPage('/finances?sortBy=mingler&sortOrder=asc')
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument()
  })

  it('says so differently when a search matched nothing', async () => {
    await renderPage('/finances?searchField=mingler&search=Zzzzz')
    expect(await screen.findByText('No transactions match your filters')).toBeInTheDocument()
    expect(screen.queryByText('No transactions yet')).not.toBeInTheDocument()
  })

  /**
   * The regression itself: the search boxes and the Date calendar live in the
   * table header, so dropping the grid stranded the partner on a page whose own
   * copy told them to change a filter that was no longer on screen.
   */
  it('keeps the column filters reachable so the search can be cleared', async () => {
    await renderPage('/finances?searchField=mingler&search=Zzzzz')
    await screen.findByText('No transactions match your filters')

    expect(screen.getByRole('columnheader', { name: 'BOOKING ID' })).toBeInTheDocument()
    // Rendered as bare SVGs, so the triggers are matched by class, not by name.
    expect(document.querySelectorAll('.ant-table-filter-trigger').length).toBeGreaterThan(0)
  })

  /**
   * The round trip QA reopened MET-1301 on: search from the column header down
   * to nothing, then clear it from that same header without reloading the page.
   */
  it('lets the partner search to nothing and clear it again from the header', async () => {
    await renderPage()
    const user = userEvent.setup()

    // bookingRef, mingler, interestTable, date — the Mingler column is second.
    const minglerFilter = () => document.querySelectorAll('.ant-table-filter-trigger')[1]
    await user.click(minglerFilter())
    await user.type(await screen.findByPlaceholderText('Search mingler…'), 'Zzzzz')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(await screen.findByText('No transactions match your filters')).toBeInTheDocument()
    expect(screen.queryByText('BK-10041')).not.toBeInTheDocument()

    await user.click(minglerFilter())
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    expect(await screen.findByText('BK-10041')).toBeInTheDocument()
    expect(screen.queryByText('No transactions match your filters')).not.toBeInTheDocument()
  })

  it('says so differently when a period matched nothing', async () => {
    clearMockFinances()
    await renderPage('/finances?period=THIS_MONTH')
    expect(await screen.findByText('No transactions match your filters')).toBeInTheDocument()
  })

  it('says so differently when a custom range matched nothing', async () => {
    await renderPage('/finances?dateFrom=2020-01-01&dateTo=2020-01-02')
    expect(await screen.findByText('No transactions match your filters')).toBeInTheDocument()
  })

  it('shows the no-match copy on mobile, where the cards rendered nothing at all', async () => {
    setDesktop(false)
    await renderPage('/finances?searchField=mingler&search=Zzzzz')
    expect(await screen.findByText('No transactions match your filters')).toBeInTheDocument()
  })

  it('shows the first-time copy on mobile when nothing is filtered', async () => {
    setDesktop(false)
    clearMockFinances()
    await renderPage()
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument()
  })
})

describe('FinancesPage ledger', () => {
  it('renders the six columns and the first page of rows', async () => {
    await renderPage()
    const row = rowFor('BK-10041')
    expect(within(row).getByText('Sana Khan')).toBeInTheDocument()
    expect(within(row).getByText('Wine & Dine')).toBeInTheDocument()
    expect(within(row).getByText('2026-05-04')).toBeInTheDocument()
    expect(within(row).getByText('PKR 2,012')).toBeInTheDocument()
    expect(within(row).getByText('PKR 1,620')).toBeInTheDocument()
  })

  it('defaults to 10 rows per page (BR-08)', async () => {
    await renderPage()
    await waitFor(() => {
      expect(document.querySelectorAll('.ant-table-tbody tr.ant-table-row')).toHaveLength(10)
    })
    expect(screen.getByText(/of 12 results/i)).toBeInTheDocument()
  })

  it('offers only the page sizes the API accepts', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getAllByRole('combobox')[1])
    const labels = Array.from(document.querySelectorAll('.ant-select-item-option-content')).map(
      (node) => node.textContent,
    )
    expect(labels).toEqual(['10 / page', '25 / page', '50 / page'])
  })

  it('preserves a stored decimal without padding it (BR-13)', async () => {
    await renderPage()
    // The 934.5 row sits on page one under the default date-descending sort.
    expect(screen.getByText('PKR 934.5')).toBeInTheDocument()
  })
})

/**
 * The filter lives in the URL so it survives navigating out to an interest table
 * and back (AC-04.3) — which makes a stale link untrusted input. These endpoints
 * 422 on a bad param instead of defaulting, so the sanitiser has to absorb it.
 */
describe('FinancesPage URL filter state', () => {
  it('applies a filter carried in the URL', async () => {
    await renderPage('/finances?searchField=mingler&search=Sana')
    await waitFor(() => {
      expect(screen.getAllByText('Sana Khan').length).toBeGreaterThan(0)
    })
    expect(screen.queryByText('Danish Ahmed')).not.toBeInTheDocument()
  })

  it('renders normally when the URL carries values the API would reject', async () => {
    // pageSize=20 and sortBy=totalAmount are both 422s if forwarded.
    await renderPage('/finances?pageSize=20&sortBy=totalAmount&period=LAST_6_MONTHS')
    expect(screen.getByText('BK-10041')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('never sends a rejected param to the API', async () => {
    const seen: string[] = []
    server.use(
      http.get(FINANCES_ENDPOINTS.ledger, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    await renderPage('/finances?pageSize=20&sortBy=totalAmount')
    await waitFor(() => {
      expect(seen.length).toBeGreaterThan(0)
    })
    expect(seen.join('')).not.toContain('pageSize=20')
    expect(seen.join('')).not.toContain('sortBy=totalAmount')
  })
})

describe('FinancesPage period filter', () => {
  it('sends the preset and drops any custom range', async () => {
    const seen: string[] = []
    server.use(
      http.get(FINANCES_ENDPOINTS.ledger, ({ request }) => {
        seen.push(new URL(request.url).search)
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )

    await renderPage('/finances?dateFrom=2026-01-01&dateTo=2026-06-30')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('combobox')[0])
    await user.click(await screen.findByText('This Year'))

    await waitFor(() => {
      expect(seen.at(-1)).toContain('period=THIS_YEAR')
    })
    // A preset and explicit dates together would be a 422.
    expect(seen.at(-1)).not.toContain('dateFrom')
  })

  it('does not offer Custom range as a choice', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getAllByRole('combobox')[0])
    const labels = Array.from(document.querySelectorAll('.ant-select-item-option-content')).map(
      (node) => node.textContent,
    )
    expect(labels).toEqual(['All Time', 'This Month', 'This Year'])
  })

  it('shows Custom range when a range came from the URL', async () => {
    await renderPage('/finances?dateFrom=2026-01-01&dateTo=2026-06-30')
    expect(screen.getByText('Custom range')).toBeInTheDocument()
  })
})

describe('FinancesPage detail modal', () => {
  it('opens on a row click and shows the detail-only fields', async () => {
    await renderPage()
    await userEvent.setup().click(screen.getByText('BK-10041'))

    expect(await screen.findByText('Transaction details')).toBeInTheDocument()
    // Present only on the detail response, never on a grid row.
    expect(await screen.findByText('GoMingle Share')).toBeInTheDocument()
    expect(screen.getByText('Loyalty Deduction')).toBeInTheDocument()
  })

  it('shows one message when the detail 404s', async () => {
    server.use(
      http.get(`${FINANCES_ENDPOINTS.ledger}/:bookingId`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_NOT_FOUND', message: 'Transaction not found.' } },
          { status: 404 },
        ),
      ),
    )
    await renderPage()
    await userEvent.setup().click(screen.getByText('BK-10041'))
    expect(await screen.findByText('Transaction not found.')).toBeInTheDocument()
  })
})

/** BR-12 — the two link cells must not also open the transaction modal. */
describe('FinancesPage row-click precedence', () => {
  it('routes to the interest table without opening the modal', async () => {
    await renderPage()
    const row = rowFor('BK-10041')
    await userEvent.setup().click(within(row).getByText('Wine & Dine'))

    expect(navigateMock).toHaveBeenCalledWith('/interest-tables/it1', expect.anything())
    expect(screen.queryByText('Transaction details')).not.toBeInTheDocument()
  })

  it('opens the Mingler profile without opening the modal', async () => {
    await renderPage()
    const row = rowFor('BK-10041')
    await userEvent.setup().click(within(row).getByText('Sana Khan'))

    expect(navigateMock).not.toHaveBeenCalled()
    expect(screen.queryByText('Transaction details')).not.toBeInTheDocument()
  })
})

/**
 * MET-1401 — the modal opened but never showed anything.
 *
 * It used to be the prototype `MinglerPreferencesModal`, reading the MSW-only
 * `/api/minglers/{id}`; against the real backend that call never resolves and the
 * component had no error branch, so the partner got a titleless box stuck on
 * "Loading…". Finances now opens the shared J6F profile modal (endpoint 9), the same
 * one Interest Tables and Reviews use. The old test only asserted what did *not*
 * happen, which is how a permanently-empty modal passed.
 */
describe('FinancesPage Mingler profile modal (MET-1401)', () => {
  it('shows the profile rather than a permanent "Loading…"', async () => {
    await renderPage()
    await userEvent.setup().click(within(rowFor('BK-10041')).getByText('Sana Khan'))

    expect(await screen.findByText('Mingler profile')).toBeInTheDocument()
    // Header: name, Pro Mingler indicator, status pill, member-since (AC-03.7).
    expect(await screen.findByText('Mingler since 10 Jan 2024')).toBeInTheDocument()
    expect(screen.getByText('Pro Mingler')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    // …and the eating-preferences grid the modal exists to show.
    expect(screen.getByText('Favourite Cuisines')).toBeInTheDocument()
    expect(screen.getByText('Italian, Mediterranean')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('hits the versioned partner endpoint, not the retired prototype route', async () => {
    const requested: string[] = []
    server.events.on('request:start', ({ request }) => requested.push(request.url))

    await renderPage()
    await userEvent.setup().click(within(rowFor('BK-10041')).getByText('Sana Khan'))
    await screen.findByText('Mingler profile')

    await waitFor(() => {
      expect(requested.some((url) => url.includes('/api/v1/partner/minglers/m-sana'))).toBe(true)
    })
    expect(requested.some((url) => /\/api\/minglers\//.test(url))).toBe(false)
    server.events.removeAllListeners()
  })

  it('says the profile is unavailable when the read fails', async () => {
    server.use(
      http.get('/api/v1/partner/minglers/:minglerId', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_NOT_FOUND', message: 'Profile unavailable.' } },
          { status: 404 },
        ),
      ),
    )
    await renderPage()
    await userEvent.setup().click(within(rowFor('BK-10041')).getByText('Sana Khan'))

    expect(await screen.findByText('Profile unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  /**
   * The close button clears `minglerModalId` and nothing else. A closed antd dialog
   * never unmounts under jsdom — the leave motion has no `transitionend` to end it —
   * so the assertion is the consequence: dismissing the profile must not fall through
   * to the row underneath and open the transaction modal.
   */
  it('dismisses the profile without opening the transaction modal', async () => {
    await renderPage()
    const user = userEvent.setup()
    await user.click(within(rowFor('BK-10041')).getByText('Sana Khan'))
    await screen.findByText('Mingler since 10 Jan 2024')

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(screen.queryByText('Transaction details')).not.toBeInTheDocument()
  })
})

describe('FinancesPage CSV export', () => {
  it('downloads the filtered set and confirms it', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:finances')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)

    await renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /export csv/i }))

    await waitFor(() => {
      expect(click).toHaveBeenCalled()
    })
    expect(createObjectURL).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:finances')
    expect(await screen.findByText(/download has started/i)).toBeInTheDocument()
    click.mockRestore()
  })

  it('reports an export failure as a toast', async () => {
    server.use(
      http.get(FINANCES_ENDPOINTS.export, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_VALIDATION', message: 'Invalid date range.' } },
          { status: 422 },
        ),
      ),
    )
    await renderPage()
    await userEvent.setup().click(screen.getByRole('button', { name: /export csv/i }))
    expect(await screen.findByText('Invalid date range.')).toBeInTheDocument()
  })
})

describe('FinancesPage mobile', () => {
  it('renders cards that open the detail modal', async () => {
    setDesktop(false)
    await renderPage()

    const card = screen.getByText('BK-10041').closest('[role="button"]') as HTMLElement
    expect(within(card).getByText('Sana Khan')).toBeInTheDocument()

    await userEvent.setup().click(card)
    expect(await screen.findByText('Transaction details')).toBeInTheDocument()
  })

  /** The cards are `role="button"`, so the keyboard has to reach the modal too. */
  it('opens the detail modal from the keyboard', async () => {
    setDesktop(false)
    await renderPage()
    const card = screen.getByText('BK-10041').closest('[role="button"]') as HTMLElement

    card.focus()
    await userEvent.setup().keyboard('{Enter}')
    expect(await screen.findByText('Transaction details')).toBeInTheDocument()
  })

  it('ignores keys that are not Enter or Space', async () => {
    setDesktop(false)
    await renderPage()
    const card = screen.getByText('BK-10041').closest('[role="button"]') as HTMLElement

    card.focus()
    await userEvent.setup().keyboard('{Escape}')
    expect(screen.queryByText('Transaction details')).not.toBeInTheDocument()
  })

  it('hides the page-size selector on mobile', async () => {
    setDesktop(false)
    await renderPage()
    // Only the period select remains.
    expect(screen.getAllByRole('combobox')).toHaveLength(1)
  })
})

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as antd from 'antd'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { Route, Routes } from 'react-router-dom'
import { FinancesPage } from '../FinancesPage'
import { downloadFileFromUrl } from '../../../../shared/utils/downloadFile'

vi.mock('../../../../shared/utils/downloadFile', () => ({
  downloadFileFromUrl: vi.fn(),
}))

// The list API sends `date` as "DD-MM-YYYY" (e.g. "29-06-2026"), not ISO.
const records = [
  {
    bookingRef: 'B1',
    restaurant: {
      id: 'a',
      name: 'Alpha',
      city: 'Karachi',
      address: null,
      lat: null,
      lng: null,
      avatarUrl: null,
    },
    mingler: { id: 'm1', name: 'M1' },
    interestTableName: 'Wine Tasting',
    date: '15-01-2024',
    eventStart: '19:00',
    eventEnd: '21:00',
    totalAmountPkr: 125,
    partnerSharePkr: 1620,
    gomingleSharePkr: 220,
  },
  {
    bookingRef: 'B2',
    restaurant: {
      id: 'b',
      name: 'Beta',
      city: 'Karachi',
      address: null,
      lat: null,
      lng: null,
      avatarUrl: null,
    },
    mingler: { id: 'm2', name: 'M2' },
    interestTableName: 'Friday Foodies',
    date: '01-02-2024',
    eventStart: '19:00',
    eventEnd: '21:00',
    totalAmountPkr: 67,
    partnerSharePkr: 52,
    gomingleSharePkr: 15,
  },
]

const listResponse = (items: typeof records) =>
  HttpResponse.json({
    success: true,
    data: {
      items,
      pagination: { page: 1, pageSize: 100, totalRecords: items.length, totalPages: 1 },
    },
  })

let lastListUrl: URL | undefined
// Counts list requests so a test can prove a *new* fetch fired, not just that the
// params happen to look right (MET-753's symptom was no request firing at all).
let listRequestCount = 0

beforeEach(() => {
  lastListUrl = undefined
  listRequestCount = 0
  server.use(
    http.get('/api/v1/admin/finances', ({ request }) => {
      lastListUrl = new URL(request.url)
      listRequestCount += 1
      return listResponse(records)
    }),
  )
  server.use(
    http.get('/api/v1/admin/finances/:bookingId', ({ params }) => {
      const rec = records.find((r) => r.bookingRef === params.bookingId) ?? records[0]
      return HttpResponse.json({
        success: true,
        data: {
          bookingRef: rec.bookingRef,
          restaurant: rec.restaurant.name,
          mingler: rec.mingler.name,
          interestTableName: 'Friday Foodies',
          date: rec.date,
          eventStart: '19:00',
          eventEnd: '21:00',
          partnerSharePkr: 0,
          gomingleSharePkr: 0,
          loyaltyRedeemedPkr: 0,
          loyaltyRedeemedPoints: 0,
          totalAmountPkr: rec.totalAmountPkr,
        },
      })
    }),
  )
})

describe('FinancesPage', () => {
  it('renders title and rows', async () => {
    renderWithProviders(<FinancesPage />)
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('renders the partner/GoMingle share columns populated from the list API', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    // The two CR-42 grid columns are populated end-to-end (API → mapper → column),
    // not the '—' fallback.
    expect(screen.getByText('PKR 1,620')).toBeInTheDocument()
    expect(screen.getByText('PKR 220')).toBeInTheDocument()
    expect(screen.getByText('PKR 52')).toBeInTheDocument()
    expect(screen.getByText('PKR 15')).toBeInTheDocument()
  })

  it('correctly formats the API\'s "DD-MM-YYYY" date instead of showing Invalid Date', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    expect(screen.getByText('2024-01-15')).toBeInTheDocument()
    expect(screen.getByText('2024-02-01')).toBeInTheDocument()
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
  })

  it('opens Escrow & payouts from the header', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/finances" element={<FinancesPage />} />
        <Route path="/finances/escrow" element={<div>Escrow console</div>} />
      </Routes>,
      { route: '/finances' },
    )
    await userEvent.click(await screen.findByRole('button', { name: /escrow & payouts/i }))
    expect(await screen.findByText('Escrow console')).toBeInTheDocument()
  })

  it('exports CSV via the /export API and downloads the returned signed URL', async () => {
    const exportUrl = 'https://s3.example.com/finances-exports/finances-16-06-2026-1430.csv?sig=xyz'
    server.use(
      http.get('/api/v1/admin/finances/export', () =>
        HttpResponse.json({ success: true, data: { url: exportUrl, expiresIn: 300 } }),
      ),
    )
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const exportBtn = screen.getByRole('button', { name: /export/i })
    await userEvent.setup().click(exportBtn)
    await waitFor(() =>
      expect(downloadFileFromUrl).toHaveBeenCalledWith(exportUrl, 'finances-16-06-2026-1430.csv'),
    )
  })

  it('shows an error message when the export API call fails', async () => {
    const messageSpy = vi
      .spyOn(antd.message, 'error')
      .mockImplementation((() => () => {}) as unknown as typeof antd.message.error)
    server.use(
      http.get('/api/v1/admin/finances/export', () => HttpResponse.json({}, { status: 500 })),
    )
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const exportBtn = screen.getByRole('button', { name: /export/i })
    await userEvent.setup().click(exportBtn)
    await waitFor(() => expect(messageSpy).toHaveBeenCalled())
    messageSpy.mockRestore()
  })

  it('clicking a row opens the detail modal and fetches its detail from the API', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    if (rows[0]) fireEvent.click(rows[0])
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /close/i }).length).toBeGreaterThan(0),
    )
    expect(await screen.findByText('Friday Foodies')).toBeInTheDocument()
  })

  it('sorts via column header (handleTableChange) and sends sortBy/sortOrder to the API', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    // Headers: Booking ID, Restaurant, Mingler, Interest Table, Date, Total Amount, Partner's Share, GoMingle Share
    await user.click(headers[0])
    await waitFor(() => expect(lastListUrl?.searchParams.get('sortBy')).toBe('bookingRef'))
    expect(lastListUrl?.searchParams.get('sortOrder')).toBe('asc')
  })

  it('changes page size and sends pageSize to the API', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[selects.length - 1])
    const opts = await screen.findAllByText(/50 \/ page/i)
    await user.click(opts[opts.length - 1])
    await waitFor(() => expect(lastListUrl?.searchParams.get('pageSize')).toBe('50'))
  })

  it('searching the booking ID column sends the bookingRef param to the API', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0])
    const input = await screen.findByPlaceholderText('Search booking ID…')
    await user.type(input, 'B1')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(lastListUrl?.searchParams.get('bookingRef')).toBe('B1'))
    // CR-62 / MET-753 — replaced the single `q` + `searchField` pair.
    expect(lastListUrl?.searchParams.get('q')).toBeNull()
    expect(lastListUrl?.searchParams.get('searchField')).toBeNull()
  })

  // MET-753 regression — the reported bug: with a Booking ID search active, the
  // Restaurant filter was ignored entirely. The old handler took the first matching
  // column and `break`ed, so the params were unchanged, the query key never moved,
  // and no request fired at all.
  it('combines a restaurant search with an active booking ID search and refetches', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')

    await user.click(filterTriggers[0])
    const bookingInput = await screen.findByPlaceholderText('Search booking ID…')
    await user.type(bookingInput, 'B1')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(lastListUrl?.searchParams.get('bookingRef')).toBe('B1'))

    // Now add the Restaurant filter on top of the active Booking ID search.
    const requestsBefore = listRequestCount
    await user.click(filterTriggers[1])
    const restaurantInput = await screen.findByPlaceholderText('Search restaurant…')
    await user.type(restaurantInput, 'Alpha')
    await user.keyboard('{Enter}')

    // A new request must fire, carrying BOTH terms (AND-combined server-side).
    await waitFor(() => expect(listRequestCount).toBeGreaterThan(requestsBefore))
    await waitFor(() => expect(lastListUrl?.searchParams.get('restaurant')).toBe('Alpha'))
    expect(lastListUrl?.searchParams.get('bookingRef')).toBe('B1')
  })

  it('clearing one column search keeps the other and drops only the cleared param', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')

    await user.click(filterTriggers[0])
    await user.type(await screen.findByPlaceholderText('Search booking ID…'), 'B1')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(lastListUrl?.searchParams.get('bookingRef')).toBe('B1'))

    await user.click(filterTriggers[1])
    await user.type(await screen.findByPlaceholderText('Search restaurant…'), 'Alpha')
    await user.keyboard('{Enter}')
    await waitFor(() => expect(lastListUrl?.searchParams.get('restaurant')).toBe('Alpha'))

    // Reset just the Restaurant filter.
    await user.click(filterTriggers[1])
    const resetBtns = await screen.findAllByRole('button', { name: /reset/i })
    await user.click(resetBtns[resetBtns.length - 1])

    await waitFor(() => expect(lastListUrl?.searchParams.get('restaurant')).toBeNull())
    expect(lastListUrl?.searchParams.get('bookingRef')).toBe('B1')
  })

  it('applying the date range filter sends dateFrom/dateTo to the API', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    // Date column is the 5th filterable trigger (bookingId, restaurant, mingler, interestTable, date)
    await user.click(filterTriggers[4])
    const inputs = document.querySelectorAll('.ant-picker-input input')
    if (inputs[0] && inputs[1]) {
      await user.type(inputs[0] as HTMLElement, '2024-01-01')
      await user.keyboard('{Enter}')
      await user.type(inputs[1] as HTMLElement, '2024-01-31')
      await user.keyboard('{Enter}')
      const applyBtn = screen.getByRole('button', { name: /apply/i })
      await user.click(applyBtn)
      await waitFor(() => expect(lastListUrl?.searchParams.get('dateFrom')).toBe('2024-01-01'))
      expect(lastListUrl?.searchParams.get('dateTo')).toBe('2024-01-31')
    }
  })

  it('selecting a period preset sends the computed dateFrom/dateTo to the API', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[0])
    await user.click(await screen.findByText(/this week/i))
    await waitFor(() => expect(lastListUrl?.searchParams.get('dateFrom')).toBeTruthy())
    expect(lastListUrl?.searchParams.get('dateTo')).toBeTruthy()
  })

  it('selecting "All Time" omits dateFrom/dateTo from the API request', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')

    await user.click(selects[0])
    await user.click(await screen.findByText(/this week/i))
    await waitFor(() => expect(lastListUrl?.searchParams.get('dateFrom')).toBeTruthy())

    await user.click(selects[0])
    await user.click(await screen.findByText(/all time/i))
    await waitFor(() => expect(lastListUrl?.searchParams.has('dateFrom')).toBe(false))
    expect(lastListUrl?.searchParams.has('dateTo')).toBe(false)
  })

  it('renders the full empty state when the API returns zero records and no filters are applied', async () => {
    server.use(http.get('/api/v1/admin/finances', () => listResponse([])))
    renderWithProviders(<FinancesPage />)
    await waitFor(() => expect(screen.getByText('All caught up')).toBeInTheDocument())
  })

  // The full empty state replaces the table, and the column filters live in the
  // table header — so showing it on a filtered-to-zero result stranded the user
  // with an applied filter and no way to clear it short of reloading.
  it('keeps the table (not the full empty state) when an active filter matches no records', async () => {
    server.use(
      http.get('/api/v1/admin/finances', ({ request }) => {
        lastListUrl = new URL(request.url)
        listRequestCount += 1
        // Empty only once a search term is present, so the first load has rows.
        return listResponse(lastListUrl.searchParams.get('bookingRef') ? [] : records)
      }),
    )
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0])
    await user.type(await screen.findByPlaceholderText('Search booking ID…'), 'NOPE')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(lastListUrl?.searchParams.get('bookingRef')).toBe('NOPE'))
    // The table survives, so its filter dropdowns remain reachable...
    await waitFor(() =>
      expect(document.querySelectorAll('.ant-table-filter-trigger').length).toBeGreaterThan(0),
    )
    // ...and the dead-end empty state is not shown.
    expect(screen.queryByText('All caught up')).not.toBeInTheDocument()
  })

  // MET-1301 — the zero-row table body used to fall back to Ant Design's generic
  // "No data" placeholder, which explains nothing about why the grid is empty.
  it('shows the no-results message inside the table and clears filters from it on desktop', async () => {
    server.use(
      http.get('/api/v1/admin/finances', ({ request }) => {
        lastListUrl = new URL(request.url)
        listRequestCount += 1
        return listResponse(lastListUrl.searchParams.get('bookingRef') ? [] : records)
      }),
    )
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0])
    await user.type(await screen.findByPlaceholderText('Search booking ID…'), 'NOPE')
    await user.keyboard('{Enter}')

    expect(await screen.findByText('No matching transactions')).toBeInTheDocument()
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
    // The "Showing 0–0 of 0 results" footer is suppressed — nothing to page.
    expect(screen.queryByText(/Showing 0–0 of 0 results/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /clear filters/i }))
    await waitFor(() => expect(lastListUrl?.searchParams.has('bookingRef')).toBe(false))
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  // MET-1301 — a period preset that matches nothing used to leave the table
  // mounted showing Ant Design's generic "No data". The design calls for the
  // full-page state with period-scoped copy; the period dropdown lives in the
  // page header, so replacing the table still leaves a way to widen back.
  it('shows the period-scoped empty state when a period preset matches no records', async () => {
    server.use(
      http.get('/api/v1/admin/finances', ({ request }) => {
        lastListUrl = new URL(request.url)
        listRequestCount += 1
        return listResponse(lastListUrl.searchParams.get('dateFrom') ? [] : records)
      }),
    )
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('combobox')[0])
    const todayOpts = await screen.findAllByText('Today')
    await user.click(todayOpts[todayOpts.length - 1])

    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText(/Try a wider date range/i)).toBeInTheDocument()
    // The "nothing exists at all" copy would be wrong here, and so would the
    // stock table placeholder.
    expect(screen.queryByText(/No transactions have been recorded yet/i)).not.toBeInTheDocument()
    expect(screen.queryByText('No data')).not.toBeInTheDocument()

    // Widening back through the header dropdown recovers the rows.
    await user.click(screen.getAllByRole('combobox')[0])
    const allTimeOpts = await screen.findAllByText('All Time')
    await user.click(allTimeOpts[allTimeOpts.length - 1])
    await waitFor(() => expect(lastListUrl?.searchParams.has('dateFrom')).toBe(false))
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('shows the period-scoped empty state on mobile too, and widening recovers', async () => {
    // Match the mobile setup the other mobile cases in this file use.
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    server.use(
      http.get('/api/v1/admin/finances', ({ request }) => {
        lastListUrl = new URL(request.url)
        listRequestCount += 1
        return listResponse(lastListUrl.searchParams.get('dateFrom') ? [] : records)
      }),
    )
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()

    // Narrow by period, which sets dateFrom/dateTo and returns nothing.
    await user.click(screen.getByText('All Time'))
    const todayOpt = await screen.findAllByText('Today')
    await user.click(todayOpt[todayOpt.length - 1])

    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(screen.getByText(/Try a wider date range/i)).toBeInTheDocument()

    // The period dropdown is the escape hatch on mobile as well — the card list
    // has no filter UI of its own.
    await user.click(screen.getAllByRole('combobox')[0])
    const allTimeOpts = await screen.findAllByText('All Time')
    await user.click(allTimeOpts[allTimeOpts.length - 1])
    await waitFor(() => expect(lastListUrl?.searchParams.has('dateFrom')).toBe(false))
    expect(await screen.findByText('Alpha')).toBeInTheDocument()

    // Restore desktop, including the matchMedia mock — leaving it on mobile
    // leaks into every later case in this file.
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => ({
      matches: /min-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  // MET-1301 (QA reopen) — a date range applied from the DATE COLUMN filter, not
  // the period dropdown, left no way back. The full-page empty state unmounts the
  // table and with it the Date filter that set the range, while the period
  // dropdown still reads "All Time" — so re-picking All Time fires no onChange
  // (Antd Select only fires on an actual change) and the page stays empty until a
  // reload.
  it('leaves a way to clear a date range applied from the Date column filter', async () => {
    server.use(
      http.get('/api/v1/admin/finances', ({ request }) => {
        lastListUrl = new URL(request.url)
        listRequestCount += 1
        return listResponse(lastListUrl.searchParams.get('dateFrom') ? [] : records)
      }),
    )
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()

    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[4])
    const inputs = document.querySelectorAll('.ant-picker-input input')
    await user.type(inputs[0] as HTMLElement, '2020-01-01')
    await user.keyboard('{Enter}')
    await user.type(inputs[1] as HTMLElement, '2020-01-31')
    await user.keyboard('{Enter}')
    await user.click(screen.getByRole('button', { name: /apply/i }))

    await waitFor(() => expect(lastListUrl?.searchParams.get('dateFrom')).toBe('2020-01-01'))

    // There must be a reachable control that clears it and recovers the rows.
    await user.click(await screen.findByRole('button', { name: /clear filters/i }))
    await waitFor(() => expect(lastListUrl?.searchParams.has('dateFrom')).toBe(false))
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
  })

  it('offers 10/25/50 page-size options, defaulting to 10', async () => {
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    await waitFor(() => expect(lastListUrl?.searchParams.get('pageSize')).toBe('10'))
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[selects.length - 1])
    // "10 / page" appears twice while open: once as the current selection, once in the list.
    expect((await screen.findAllByText('10 / page')).length).toBeGreaterThan(0)
    expect(screen.getByText('25 / page')).toBeInTheDocument()
    expect(screen.getByText('50 / page')).toBeInTheDocument()
  })

  it('mobile mode: view details on a card', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Alpha')
    const view = screen.queryAllByRole('button', { name: /view details/i })
    if (view[0]) await userEvent.setup().click(view[0])
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
  })

  it('mobile pagination next page click', async () => {
    // Make 50 records so paginate kicks in
    const many = Array.from({ length: 50 }, (_, i) => ({
      ...records[0],
      bookingRef: `MB${i}`,
      restaurant: { ...records[0].restaurant, name: `Mob${i}` },
    }))
    server.use(http.get('/api/v1/admin/finances', () => listResponse(many)))
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
    renderWithProviders(<FinancesPage />)
    await screen.findByText('Mob0')
    const nextBtn = screen.queryByTitle('Next Page')
    if (nextBtn) await userEvent.setup().click(nextBtn)
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
  })
})

describe('FinancesPage — error and loading states', () => {
  it('shows loading spinner while fetching', () => {
    renderWithProviders(<FinancesPage />)
    // isPending is true on the first synchronous render before the fetch resolves
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
  })

  it('shows error alert when the fetch fails', async () => {
    server.use(http.get('/api/v1/admin/finances', () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<FinancesPage />)
    await waitFor(() => expect(document.querySelector('.ant-alert-error')).not.toBeNull())
  })
})

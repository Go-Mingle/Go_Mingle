import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTablesTable } from '../components/InterestTablesTable'
import type { InterestTable } from '../types'

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

const rows: InterestTable[] = [
  {
    id: '1',
    name: 'Friday Wine Evening',
    topic: { id: 't1', name: 'Wine Tasting', graphicUrl: null },
    assignedTable: { id: 'a1', name: 'Table 4' },
    restaurant: { id: 'r1', name: 'The Grand' },
    seatsBooked: 2,
    minMinglers: 3,
    maxMinglers: 6,
    startDate: '2026-07-10',
    startTime: '19:00',
    durationHours: 2,
    sponsorName: null,
    sponsorLogoUrl: null,
    eventImageUrl: 'https://example.com/img.jpg',
    timeLeft: '2d 3h',
    status: 'PENDING',
    created: '2026-01-01T00:00:00.000Z',
    availabilityMode: 'AVAILABLE_NOW',
    maxGuests: 6,
    inviteOnly: false,
    prominglerEnabled: true,
    promingler: { id: 'm1', fullName: 'Laiba Hassan' },
  },
  {
    id: '2',
    name: 'Saturday Sushi Social',
    topic: null,
    assignedTable: null,
    restaurant: { id: 'r2', name: 'Sushi House' },
    seatsBooked: 6,
    minMinglers: 3,
    maxMinglers: 6,
    startDate: '2026-07-12',
    startTime: '20:00',
    durationHours: 3,
    sponsorName: 'TechFlow',
    sponsorLogoUrl: null,
    eventImageUrl: null,
    timeLeft: 'Started',
    status: 'CONFIRMED',
    created: '2026-02-01T00:00:00.000Z',
    availabilityMode: 'COMING_SOON',
    inviteOnly: true,
    prominglerEnabled: false,
  },
]

// Row whose `created` uses the real API shape ("DD-MM-YYYY HH:mm") so the
// formatted Date & Time assertion is deterministic (no timezone conversion).
const dateRow: InterestTable[] = [
  { ...rows[0], id: 'd1', name: 'Formatted Date Table', created: '16-07-2026 15:44' },
  { ...rows[0], id: 'd2', name: 'Missing Date Table', created: '' },
]

describe('InterestTablesTable (desktop)', () => {
  it('maps the created field into the "DD-MM-YYYY · h:mm A" Date & Time format', () => {
    renderWithProviders(<InterestTablesTable pagedData={dateRow} onView={vi.fn()} />)
    expect(screen.getByText('16-07-2026 · 3:44 PM')).toBeInTheDocument()
    // No "Invalid Date" leaks through for a non-ISO created value.
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
  })

  it('renders a dash for a row with a missing/unparseable created value', () => {
    renderWithProviders(<InterestTablesTable pagedData={[dateRow[1]]} onView={vi.fn()} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
  })

  it('renders header cells and every row', () => {
    renderWithProviders(<InterestTablesTable pagedData={rows} onView={vi.fn()} />)
    expect(screen.getAllByText(/max guests/i).length).toBeGreaterThan(0)
    expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument()
    expect(screen.getByText('Saturday Sushi Social')).toBeInTheDocument()
  })

  it('renders fallback dashes for missing max guests and promingler', () => {
    renderWithProviders(<InterestTablesTable pagedData={rows} onView={vi.fn()} />)
    const dashCells = screen.getAllByText('—')
    expect(dashCells.length).toBeGreaterThanOrEqual(2)
  })

  it('renders the promingler name as plain text when no onProminglerClick is given', () => {
    renderWithProviders(<InterestTablesTable pagedData={rows} onView={vi.fn()} />)
    const name = screen.getByText('Laiba Hassan')
    expect(name).toBeInTheDocument()
    expect(name.closest('[role="button"]')).toBeNull()
  })

  it('links the promingler name to the mingler and does not trigger the row onView', () => {
    const onView = vi.fn()
    const onProminglerClick = vi.fn()
    renderWithProviders(
      <InterestTablesTable
        pagedData={rows}
        onView={onView}
        onProminglerClick={onProminglerClick}
      />,
    )
    const link = screen.getByText('Laiba Hassan')
    expect(link).toHaveAttribute('role', 'button')
    fireEvent.click(link)
    expect(onProminglerClick).toHaveBeenCalledWith('m1')
    // stopPropagation keeps the row's own navigation from firing.
    expect(onView).not.toHaveBeenCalled()
  })

  it('no longer renders a standalone view/eye action in the actions column', () => {
    renderWithProviders(<InterestTablesTable pagedData={rows} onView={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /view/i })).toBeNull()
  })

  it('renders an empty table with no rows', () => {
    renderWithProviders(<InterestTablesTable pagedData={[]} onView={vi.fn()} />)
    expect(screen.getAllByText(/no data/i).length).toBeGreaterThan(0)
  })

  it('calls onView when a row is clicked', () => {
    const onView = vi.fn()
    const { container } = renderWithProviders(
      <InterestTablesTable pagedData={rows} onView={onView} />,
    )
    const dataRow = container.querySelector('tbody tr.ant-table-row')
    expect(dataRow).not.toBeNull()
    fireEvent.click(dataRow as HTMLElement)
    expect(onView).toHaveBeenCalledWith('1')
  })

  it('surfaces the name search to the server via onFiltersChange (no client narrowing)', async () => {
    const onFiltersChange = vi.fn()
    renderWithProviders(
      <InterestTablesTable pagedData={rows} onView={vi.fn()} onFiltersChange={onFiltersChange} />,
    )
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = await screen.findByPlaceholderText('Search tables…')
    await user.type(input, 'Sushi')
    await user.keyboard('{Enter}')
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ q: 'Sushi' }))
    // Presentational/controlled: the component itself does not narrow rows.
    expect(screen.getByText('Saturday Sushi Social')).toBeInTheDocument()
    expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument()
  })

  it('surfaces the status filter to the server via onFiltersChange (single-select)', async () => {
    const onFiltersChange = vi.fn()
    renderWithProviders(
      <InterestTablesTable pagedData={rows} onView={vi.fn()} onFiltersChange={onFiltersChange} />,
    )
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    // Columns with a filter, in order: name[0], availability[1], inviteOnly[2], status[3].
    const statusTrigger = filterTriggers[3]
    await user.click(statusTrigger as HTMLElement)
    const options = document.querySelectorAll('.ant-table-filter-dropdown .ant-dropdown-menu-item')
    // DRAFT, COMING_SOON, PENDING, CONFIRMED, COMPLETED, CANCELLED
    expect(options.length).toBe(6)
    const pendingOption = Array.from(options).find((o) => /^pending$/i.test(o.textContent ?? ''))
    await user.click(pendingOption as HTMLElement)
    const okBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown-btns button'),
    ).find((b) => /ok/i.test(b.textContent ?? ''))
    if (okBtn) await user.click(okBtn as HTMLElement)
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'PENDING' }))
  })

  it('surfaces a name-column sort to the server (sortBy=name, uppercase order)', () => {
    const onFiltersChange = vi.fn()
    renderWithProviders(
      <InterestTablesTable pagedData={rows} onView={vi.fn()} onFiltersChange={onFiltersChange} />,
    )
    // Sortable columns in order: name[0], dateTime[1].
    const sortHeaders = document.querySelectorAll(
      '.ant-table-thead th.ant-table-column-has-sorters',
    )
    fireEvent.click(sortHeaders[0] as HTMLElement)
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'name', sortOrder: 'ASC' }),
    )
  })

  it('surfaces a date-column sort to the server (sortBy=created)', () => {
    const onFiltersChange = vi.fn()
    renderWithProviders(
      <InterestTablesTable pagedData={rows} onView={vi.fn()} onFiltersChange={onFiltersChange} />,
    )
    const sortHeaders = document.querySelectorAll(
      '.ant-table-thead th.ant-table-column-has-sorters',
    )
    fireEvent.click(sortHeaders[1] as HTMLElement)
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'created', sortOrder: 'ASC' }),
    )
  })

  it('toggles to DESC then clears the sort on repeated header clicks', () => {
    const onFiltersChange = vi.fn()
    renderWithProviders(
      <InterestTablesTable pagedData={rows} onView={vi.fn()} onFiltersChange={onFiltersChange} />,
    )
    const nameHeader = document.querySelectorAll(
      '.ant-table-thead th.ant-table-column-has-sorters',
    )[0] as HTMLElement
    fireEvent.click(nameHeader) // ascend
    fireEvent.click(nameHeader) // descend
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: 'name', sortOrder: 'DESC' }),
    )
    fireEvent.click(nameHeader) // cleared
    expect(onFiltersChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ sortBy: undefined, sortOrder: undefined }),
    )
  })

  it('surfaces the availability (mode) filter via onFiltersChange (parent narrows client-side)', async () => {
    const onFiltersChange = vi.fn()
    renderWithProviders(
      <InterestTablesTable pagedData={rows} onView={vi.fn()} onFiltersChange={onFiltersChange} />,
    )
    const user = userEvent.setup()
    // Columns with a filter, in order: name[0], availability[1], inviteOnly[2], status[3].
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[1] as HTMLElement)
    const options = document.querySelectorAll('.ant-table-filter-dropdown .ant-dropdown-menu-item')
    // Available now, Coming soon
    expect(options.length).toBe(2)
    const comingSoon = Array.from(options).find((o) => /coming soon/i.test(o.textContent ?? ''))
    await user.click(comingSoon as HTMLElement)
    const okBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown-btns button'),
    ).find((b) => /ok/i.test(b.textContent ?? ''))
    if (okBtn) await user.click(okBtn as HTMLElement)
    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'COMING_SOON' }))
  })
})

describe('InterestTablesTable (mobile)', () => {
  it('renders mobile cards with name, status badge, availability and promingler', () => {
    setMobile(true)
    renderWithProviders(<InterestTablesTable pagedData={rows} onView={vi.fn()} />)
    expect(screen.getByText('Friday Wine Evening')).toBeInTheDocument()
    expect(screen.getByText('Saturday Sushi Social')).toBeInTheDocument()
    expect(screen.getByText('Available now')).toBeInTheDocument()
    expect(screen.getByText('Laiba Hassan')).toBeInTheDocument()
    setMobile(false)
  })

  it('links the promingler name in a mobile card without triggering the card onView', () => {
    setMobile(true)
    const onView = vi.fn()
    const onProminglerClick = vi.fn()
    renderWithProviders(
      <InterestTablesTable
        pagedData={rows}
        onView={onView}
        onProminglerClick={onProminglerClick}
      />,
    )
    fireEvent.click(screen.getByText('Laiba Hassan'))
    expect(onProminglerClick).toHaveBeenCalledWith('m1')
    expect(onView).not.toHaveBeenCalled()
    setMobile(false)
  })

  it('calls onView when a mobile card is clicked or activated via keyboard', async () => {
    setMobile(true)
    const onView = vi.fn()
    renderWithProviders(<InterestTablesTable pagedData={rows} onView={onView} />)
    const card = screen.getByText('Friday Wine Evening').closest('[role="button"]')
    expect(card).not.toBeNull()
    fireEvent.click(card as HTMLElement)
    expect(onView).toHaveBeenCalledWith('1')

    fireEvent.keyDown(card as HTMLElement, { key: 'Enter' })
    expect(onView).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(card as HTMLElement, { key: ' ' })
    expect(onView).toHaveBeenCalledTimes(3)

    fireEvent.keyDown(card as HTMLElement, { key: 'Tab' })
    expect(onView).toHaveBeenCalledTimes(3)
    setMobile(false)
  })

  it('renders an empty list of cards with no data', () => {
    setMobile(true)
    const { container } = renderWithProviders(
      <InterestTablesTable pagedData={[]} onView={vi.fn()} />,
    )
    expect(container.querySelectorAll('[role="button"]').length).toBe(0)
    setMobile(false)
  })

  it('maps the created field into the formatted Date & Time in mobile cards', () => {
    setMobile(true)
    renderWithProviders(<InterestTablesTable pagedData={dateRow} onView={vi.fn()} />)
    expect(screen.getByText('16-07-2026 · 3:44 PM')).toBeInTheDocument()
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
    setMobile(false)
  })
})

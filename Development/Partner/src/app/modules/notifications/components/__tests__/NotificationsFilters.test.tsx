import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useState } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { NotificationsFilters } from '../NotificationsFilters'
import type { DateRangeValue, SortOrder } from '../NotificationsFilters'
import type { NotificationStatus, NotificationTypeOption } from '../../types'

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

/** As the catalogue endpoint returns them — labels included, so nothing is hardcoded. */
const TYPE_OPTIONS: NotificationTypeOption[] = [
  { type: 'IT_CANCELLED', label: 'Interest table cancelled' },
  { type: 'IT_CONFIRMED', label: 'Interest table confirmed' },
  { type: 'IT_CREATED', label: 'New interest table created' },
]

interface HarnessProps {
  initialSearch?: string
  initialTypes?: string[]
  initialStatus?: NotificationStatus
  initialDateRange?: DateRangeValue
  initialSort?: SortOrder
  unreadCount?: number
  typeOptions?: NotificationTypeOption[]
  onMarkAllRead?: () => void
  onClearFilters?: () => void
}

/**
 * Controlled wrapper, so interactions really update state and the assertions are about
 * behaviour (visible tags, badge counts, toggled labels) rather than prop plumbing.
 */
function Harness({
  initialSearch = '',
  initialTypes = [],
  initialStatus = 'ALL',
  initialDateRange = null,
  initialSort = 'desc',
  unreadCount = 3,
  typeOptions = TYPE_OPTIONS,
  onMarkAllRead = vi.fn(),
  onClearFilters,
}: HarnessProps) {
  const [searchTerm, setSearchTerm] = useState(initialSearch)
  const [typeFilters, setTypeFilters] = useState<string[]>(initialTypes)
  const [status, setStatus] = useState<NotificationStatus>(initialStatus)
  const [dateRange, setDateRange] = useState<DateRangeValue>(initialDateRange)
  const [sortOrder, setSortOrder] = useState<SortOrder>(initialSort)

  const clear =
    onClearFilters ??
    (() => {
      setTypeFilters([])
      setStatus('ALL')
      setDateRange(null)
      setSearchTerm('')
    })

  const hasFilters =
    Boolean(searchTerm) ||
    typeFilters.length > 0 ||
    status !== 'ALL' ||
    Boolean(dateRange?.[0] && dateRange?.[1])

  return (
    <NotificationsFilters
      searchTerm={searchTerm}
      onSearchChange={setSearchTerm}
      typeFilters={typeFilters}
      onTypeFiltersChange={setTypeFilters}
      typeOptions={typeOptions}
      status={status}
      onStatusChange={setStatus}
      dateRange={dateRange}
      onDateRangeChange={setDateRange}
      sortOrder={sortOrder}
      onSortOrderToggle={() => setSortOrder((s) => (s === 'desc' ? 'asc' : 'desc'))}
      unreadCount={unreadCount}
      onMarkAllRead={onMarkAllRead}
      onClearFilters={clear}
      hasFilters={hasFilters}
    />
  )
}

describe('NotificationsFilters (desktop)', () => {
  beforeEach(() => {
    setMobile(false)
  })

  it('renders search, both selects, sort and mark-all', () => {
    renderWithProviders(<Harness />)

    expect(screen.getByPlaceholderText('Search notifications…')).toBeInTheDocument()
    expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByRole('button', { name: /newest first/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /mark all as read/i })).toBeInTheDocument()
  })

  it('propagates search input changes', async () => {
    renderWithProviders(<Harness />)
    const input = screen.getByPlaceholderText('Search notifications…')

    await userEvent.type(input, 'mixer')
    expect(input).toHaveValue('mixer')
  })

  /** Options come from the catalogue, so their labels are the server's. */
  it('offers the catalogue types and selects one', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(await screen.findByText('New interest table created'))

    expect(await screen.findAllByText('New interest table created')).not.toHaveLength(0)
  })

  /** BR-02 — a type not in the catalogue is never offered as a filter. */
  it('offers nothing when the catalogue is empty', async () => {
    renderWithProviders(<Harness typeOptions={[]} />)

    await userEvent.click(screen.getAllByRole('combobox')[0])
    expect(screen.queryByText('Interest table cancelled')).not.toBeInTheDocument()
  })

  /** Single-select now: ALL is the absence of a filter, not a third tick-box. */
  it('selects a single status', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getAllByRole('combobox')[1])
    await userEvent.click(await screen.findByTitle('Unread'))

    expect(await screen.findAllByText('Unread')).not.toHaveLength(0)
  })

  it('offers All, Unread and Read', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getAllByRole('combobox')[1])
    for (const label of ['All', 'Unread', 'Read']) {
      expect(
        await screen.findByText(label, { selector: '.ant-select-item-option-content' }),
      ).toBeInTheDocument()
    }
  })

  it('toggles sort order both ways', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: /newest first/i }))
    expect(screen.getByRole('button', { name: /oldest first/i })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /oldest first/i }))
    expect(screen.getByRole('button', { name: /newest first/i })).toBeInTheDocument()
  })

  it('renders the oldest-first variant when sorting ascending', () => {
    renderWithProviders(<Harness initialSort="asc" />)
    expect(screen.getByRole('button', { name: /oldest first/i })).toBeInTheDocument()
  })

  it('invokes mark-all-read', async () => {
    const onMarkAllRead = vi.fn()
    renderWithProviders(<Harness onMarkAllRead={onMarkAllRead} />)

    await userEvent.click(screen.getByRole('button', { name: /mark all as read/i }))
    expect(onMarkAllRead).toHaveBeenCalledTimes(1)
  })

  /** BR-09 — removed, not disabled. */
  it('removes mark-all-read when nothing is unread', () => {
    renderWithProviders(<Harness unreadCount={0} />)
    expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument()
  })

  it('offers clear-filters only once something is filtered', async () => {
    renderWithProviders(<Harness />)
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument()

    await userEvent.type(screen.getByPlaceholderText('Search notifications…'), 'x')
    expect(await screen.findByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('clears every filter at once', async () => {
    const onClearFilters = vi.fn()
    renderWithProviders(<Harness initialStatus="READ" onClearFilters={onClearFilters} />)

    await userEvent.click(screen.getByRole('button', { name: /clear filters/i }))
    expect(onClearFilters).toHaveBeenCalledTimes(1)
  })

  /**
   * MET-1263 — at 1280 the eight controls left the search box 0px wide, so a partner saw a
   * magnifier they could not type into. jsdom does no layout, so the guard is on the two
   * classes that produce the behaviour: a floor on the search and a row that wraps instead
   * of compressing.
   */
  it('gives the search a minimum width and lets the filter row wrap', () => {
    renderWithProviders(<Harness />)

    const wrapper = screen
      .getByPlaceholderText('Search notifications…')
      .closest('.ant-input-affix-wrapper')
    expect(wrapper).toHaveClass('min-w-[200px]', 'flex-1')
    expect(wrapper?.closest('div')).toHaveClass('flex-wrap')
  })

  it('renders a date range picker', () => {
    renderWithProviders(<Harness />)
    expect(document.querySelector('.ant-picker-range')).toBeTruthy()
  })

  /**
   * The picker's `disabledDate` predicate is `isDateOutsideWindow`, unit-tested directly in
   * `format.test.ts`. Asserting AntD's disabled-cell markup here would test the library
   * rather than the rule, and breaks on any internal markup change.
   */
  it('wires a disabled-date rule onto the picker', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(document.querySelector('.ant-picker-input input') as HTMLElement)
    expect(document.querySelector('.ant-picker-cell-disabled')).toBeTruthy()
  })
})

describe('NotificationsFilters (mobile)', () => {
  beforeEach(() => {
    setMobile(true)
  })

  it('renders search, the filter button and the sort row', () => {
    renderWithProviders(<Harness />)

    expect(screen.getByPlaceholderText('Search notifications…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /newest first/i })).toBeInTheDocument()
  })

  it('counts the active filter groups on the badge', () => {
    renderWithProviders(
      <Harness
        initialTypes={['IT_CREATED']}
        initialStatus="UNREAD"
        initialDateRange={[dayjs('2026-05-01'), dayjs('2026-05-31')]}
      />,
    )

    // 1 type + 1 status + 1 date range.
    expect(
      within(screen.getByRole('button', { name: /filters/i })).getByText('3'),
    ).toBeInTheDocument()
  })

  /** ALL is the absence of a filter, so it must not inflate the count. */
  it('does not count the ALL status', () => {
    renderWithProviders(<Harness initialStatus="ALL" />)
    const filterBtn = screen.getByRole('button', { name: /filters/i })

    expect(within(filterBtn).queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it('does not count a half-filled date range', () => {
    renderWithProviders(<Harness initialDateRange={[dayjs('2026-05-01'), null]} />)
    const filterBtn = screen.getByRole('button', { name: /filters/i })

    expect(within(filterBtn).queryByText(/^\d+$/)).not.toBeInTheDocument()
  })

  it('opens the modal, clears everything and applies', async () => {
    renderWithProviders(<Harness initialTypes={['IT_CREATED']} initialStatus="READ" />)

    const filterBtn = screen.getByRole('button', { name: /filters/i })
    expect(within(filterBtn).getByText('2')).toBeInTheDocument()

    await userEvent.click(filterBtn)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Type')).toBeInTheDocument()
    expect(within(dialog).getByText('Status')).toBeInTheDocument()
    expect(within(dialog).getByText('Date range')).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: /clear all/i }))
    await vi.waitFor(() => {
      expect(within(filterBtn).queryByText(/^\d+$/)).not.toBeInTheDocument()
    })

    await userEvent.click(within(dialog).getByRole('button', { name: /^apply$/i }))
  })

  it('closes the modal via its close button', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Date range')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /close/i }))
  })

  it('selects a type from within the modal', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: /filters/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getAllByRole('combobox')[0])
    await userEvent.click(await screen.findByText('Interest table confirmed'))

    expect(await screen.findAllByText('Interest table confirmed')).not.toHaveLength(0)
  })

  it('toggles sort order on mobile', async () => {
    renderWithProviders(<Harness />)

    await userEvent.click(screen.getByRole('button', { name: /newest first/i }))
    expect(screen.getByRole('button', { name: /oldest first/i })).toBeInTheDocument()
  })

  it('removes mark-all when nothing is unread', () => {
    renderWithProviders(<Harness unreadCount={0} />)
    expect(screen.queryByRole('button', { name: /mark all as read/i })).not.toBeInTheDocument()
  })
})

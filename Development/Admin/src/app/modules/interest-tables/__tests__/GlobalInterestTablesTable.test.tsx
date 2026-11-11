import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { GlobalInterestTablesTable } from '../components/GlobalInterestTablesTable'
import type { ListAllInterestTablesParams, MasterInterestTableItem } from '../types'

const baseParams: ListAllInterestTablesParams = {
  page: 1,
  pageSize: 10,
  sortBy: 'dateTime',
  sortOrder: 'desc',
}

const row = (over: Partial<MasterInterestTableItem> = {}): MasterInterestTableItem => ({
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

const restaurantOptions = [
  { label: 'Aurelia', value: 'r1' },
  { label: 'Bistro Nord', value: 'r2' },
]

/** jsdom reports no width, so AntD's Grid needs help to pick a breakpoint. */
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

function renderTable(props: Partial<React.ComponentProps<typeof GlobalInterestTablesTable>> = {}) {
  return renderWithProviders(
    <GlobalInterestTablesTable
      items={[row()]}
      params={baseParams}
      onParamsChange={vi.fn()}
      onView={vi.fn()}
      restaurantOptions={restaurantOptions}
      {...props}
    />,
  )
}

describe('GlobalInterestTablesTable (desktop)', () => {
  beforeEach(() => setMobile(false))
  afterEach(() => vi.restoreAllMocks())

  it('renders every master-list column', () => {
    renderTable()
    expect(screen.getAllByText('INTEREST TABLE').length).toBeGreaterThan(0)
    expect(screen.getAllByText('RESTAURANT').length).toBeGreaterThan(0)
    expect(screen.getAllByText('DATE & TIME').length).toBeGreaterThan(0)
    expect(screen.getAllByText('MAX GUESTS').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Availability').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Invite only').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Promingler').length).toBeGreaterThan(0)
    expect(screen.getAllByText('STATUS').length).toBeGreaterThan(0)
  })

  it('renders the row values', () => {
    renderTable({ items: [row({ maxGuests: 8, inviteOnly: true })] })
    expect(screen.getByText('Alpha Dinner')).toBeInTheDocument()
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('12-07-2026 · 8:00 PM')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Available now')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('shows a dash for a row without a restaurant', () => {
    renderTable({ items: [row({ restaurant: null })] })
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('fires onRestaurantClick with the restaurant id and does not also fire onView', async () => {
    const onRestaurantClick = vi.fn()
    const onView = vi.fn()
    renderTable({ onRestaurantClick, onView })
    await userEvent.click(screen.getByText('Aurelia'))
    expect(onRestaurantClick).toHaveBeenCalledWith('r1')
    expect(onView).not.toHaveBeenCalled()
  })

  it('renders the restaurant as plain text when no handler is supplied', async () => {
    const onView = vi.fn()
    renderTable({ onView })
    await userEvent.click(screen.getByText('Aurelia'))
    // No link handler → the click falls through to the row.
    expect(onView).toHaveBeenCalled()
  })

  it('renders Self Captain when there is no promingler', () => {
    renderTable({ items: [row({ promingler: null })] })
    expect(screen.getByText('Self Captain')).toBeInTheDocument()
  })

  it('renders a bare promingler name without a link', async () => {
    const onProminglerClick = vi.fn()
    renderTable({ items: [row({ promingler: 'Laiba Hassan' })], onProminglerClick })
    await userEvent.click(screen.getByText('Laiba Hassan'))
    expect(onProminglerClick).not.toHaveBeenCalled()
  })

  it('links the promingler when the API supplies an id', async () => {
    const onProminglerClick = vi.fn()
    const onView = vi.fn()
    renderTable({
      items: [row({ promingler: { id: 'm1', name: 'Laiba Hassan' } })],
      onProminglerClick,
      onView,
    })
    await userEvent.click(screen.getByText('Laiba Hassan'))
    expect(onProminglerClick).toHaveBeenCalledWith('m1')
    expect(onView).not.toHaveBeenCalled()
  })

  it('fires onView when the row is clicked', async () => {
    const onView = vi.fn()
    renderTable({ onView })
    await userEvent.click(document.querySelector('tbody tr.ant-table-row') as HTMLElement)
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ id: 'it1' }))
  })

  it('renders no view icon in the actions cell', () => {
    renderTable()
    const cell = document.querySelector('tbody tr.ant-table-row td:last-child') as HTMLElement
    expect(cell.querySelectorAll('svg')).toHaveLength(0)
  })

  it('only offers Make available on a COMING_SOON row', () => {
    const onMakeAvailable = vi.fn()
    const { unmount } = renderTable({ items: [row({ status: 'PENDING' })], onMakeAvailable })
    expect(
      (
        document.querySelector('tbody tr.ant-table-row td:last-child') as HTMLElement
      ).querySelectorAll('svg'),
    ).toHaveLength(0)
    unmount()

    renderTable({ items: [row({ status: 'COMING_SOON' })], onMakeAvailable })
    expect(
      (
        document.querySelector('tbody tr.ant-table-row td:last-child') as HTMLElement
      ).querySelectorAll('svg'),
    ).toHaveLength(1)
  })

  it('offers the edit pencil on tables that have not happened yet, and opens edit mode', async () => {
    const onEdit = vi.fn()
    const onView = vi.fn()
    const { unmount } = renderTable({ items: [row({ status: 'CANCELLED' })], onEdit })
    expect(
      (
        document.querySelector('tbody tr.ant-table-row td:last-child') as HTMLElement
      ).querySelectorAll('svg'),
    ).toHaveLength(0)
    unmount()

    renderTable({ items: [row({ status: 'PENDING' })], onEdit, onView })
    const icons = (
      document.querySelector('tbody tr.ant-table-row td:last-child') as HTMLElement
    ).querySelectorAll('svg')
    expect(icons).toHaveLength(1)
    await userEvent.click(icons[0].parentElement as HTMLElement)
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'it1' }))
    expect(onView).not.toHaveBeenCalled()
  })

  it('fires onMakeAvailable without triggering the row click', async () => {
    const onMakeAvailable = vi.fn()
    const onView = vi.fn()
    renderTable({ items: [row({ status: 'COMING_SOON' })], onMakeAvailable, onView })
    const icons = (
      document.querySelector('tbody tr.ant-table-row td:last-child') as HTMLElement
    ).querySelectorAll('svg')
    await userEvent.click(icons[icons.length - 1].parentElement as HTMLElement)
    expect(onMakeAvailable).toHaveBeenCalledWith('it1')
    expect(onView).not.toHaveBeenCalled()
  })

  it('reflects the controlled sort state from params', () => {
    renderTable({ params: { ...baseParams, sortBy: 'interestTable', sortOrder: 'asc' } })
    expect(document.querySelector('th.ant-table-column-sort')).toBeTruthy()
  })

  it('surfaces a sort change through onParamsChange', async () => {
    const onParamsChange = vi.fn()
    renderTable({ onParamsChange })
    await userEvent.click(screen.getAllByText('MAX GUESTS')[0])
    expect(onParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'maxGuests', sortOrder: 'asc' }),
    )
  })

  it('surfaces a multi-select status filter through onParamsChange', async () => {
    const onParamsChange = vi.fn()
    renderTable({ onParamsChange })
    // name[0], restaurant[1], availability[2], inviteOnly[3], status[4]
    const triggers = document.querySelectorAll('.ant-table-filter-trigger')
    await userEvent.click(triggers[4] as HTMLElement)
    const dropdown = document.querySelector('.ant-table-filter-dropdown') as HTMLElement
    const pending = Array.from(dropdown.querySelectorAll('.ant-dropdown-menu-item')).find((o) =>
      /^pending$/i.test(o.textContent ?? ''),
    )
    await userEvent.click(pending as HTMLElement)
    const ok = Array.from(dropdown.querySelectorAll('button')).find((b) =>
      /ok/i.test(b.textContent ?? ''),
    )
    await userEvent.click(ok as HTMLElement)
    expect(onParamsChange).toHaveBeenCalledWith(expect.objectContaining({ status: ['PENDING'] }))
  })

  it('surfaces the Restaurant column search and ids through onParamsChange', async () => {
    const onParamsChange = vi.fn()
    renderTable({ onParamsChange })
    const triggers = document.querySelectorAll('.ant-table-filter-trigger')
    await userEvent.click(triggers[1] as HTMLElement)
    const dropdown = document.querySelector('.ant-table-filter-dropdown') as HTMLElement
    await userEvent.type(within(dropdown).getByRole('textbox'), 'Aurelia')
    await userEvent.click(within(dropdown).getAllByRole('checkbox')[1])
    await userEvent.click(within(dropdown).getByRole('button', { name: /apply/i }))
    expect(onParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'Aurelia',
        searchField: 'restaurant',
        restaurantId: ['r2'],
      }),
    )
  })

  it('passes the loading flag through to the table', () => {
    renderTable({ loading: true })
    expect(document.querySelector('.ant-spin')).toBeTruthy()
  })
})

describe('GlobalInterestTablesTable (mobile)', () => {
  beforeEach(() => setMobile(true))
  afterEach(() => {
    setMobile(false)
    vi.restoreAllMocks()
  })

  it('renders cards instead of a table', () => {
    renderTable({ items: [row({ promingler: 'Laiba Hassan' })] })
    expect(document.querySelector('table')).toBeNull()
    expect(screen.getByText('Alpha Dinner')).toBeInTheDocument()
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('12-07-2026 · 8:00 PM')).toBeInTheDocument()
    expect(screen.getByText('Available now')).toBeInTheDocument()
    expect(screen.getByText('Laiba Hassan')).toBeInTheDocument()
  })

  it('shows Self Captain and a dash for a bare row', () => {
    renderTable({ items: [row({ restaurant: null, availabilityMode: undefined as never })] })
    expect(screen.getByText('Self Captain')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('fires onView on card click and on Enter', async () => {
    const onView = vi.fn()
    renderTable({ onView })
    const card = screen.getByRole('button', { name: /Alpha Dinner/ })
    await userEvent.click(card)
    expect(onView).toHaveBeenCalledTimes(1)

    card.focus()
    await userEvent.keyboard('{Enter}')
    expect(onView).toHaveBeenCalledTimes(2)
    await userEvent.keyboard(' ')
    expect(onView).toHaveBeenCalledTimes(3)
  })

  it('links the restaurant from the card without firing onView', async () => {
    const onRestaurantClick = vi.fn()
    const onView = vi.fn()
    renderTable({ onRestaurantClick, onView })
    await userEvent.click(screen.getByText('Aurelia'))
    expect(onRestaurantClick).toHaveBeenCalledWith('r1')
    expect(onView).not.toHaveBeenCalled()
  })

  it('links the promingler from the card without firing onView', async () => {
    const onProminglerClick = vi.fn()
    const onView = vi.fn()
    renderTable({
      items: [row({ promingler: { id: 'm1', name: 'Laiba Hassan' } })],
      onProminglerClick,
      onView,
    })
    await userEvent.click(screen.getByText('Laiba Hassan'))
    expect(onProminglerClick).toHaveBeenCalledWith('m1')
    expect(onView).not.toHaveBeenCalled()
  })
})

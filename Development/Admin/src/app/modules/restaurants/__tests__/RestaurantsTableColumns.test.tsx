import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { buildRestaurantsColumns } from '../components/RestaurantsTableColumns'
import { buildRestaurantNameColumn } from '../components/RestaurantNameColumn'
import { restaurantJoinedColumn } from '../components/RestaurantJoinedColumn'
import i18n from '../../../../locales/i18n'
import type { Restaurant } from '../components/restaurantsPage.types'

type BadgeElement = React.ReactElement<{
  children: React.ReactNode
  style: { background: string }
}>
type IconElement = React.ReactElement<{ weight: string }>

const categoryOptions = [
  { text: 'Premium', value: 'cat-premium' },
  { text: 'Standard', value: 'cat-standard' },
]

const rows: Restaurant[] = [
  {
    id: '1',
    name: 'Alpha Bistro',
    cuisine: 'Italian',
    city: 'Karachi',
    category: 'Premium',
    status: 'ACTIVE',
    bookings: 120,
    joinedDate: '2024-01-15',
    avatarColor: '#123456',
  },
  {
    id: '2',
    name: 'Beta Diner',
    cuisine: 'Fast Food',
    city: 'Lahore',
    category: 'Standard',
    status: 'SUSPENDED',
    bookings: 45,
    joinedDate: '2024-03-20',
    avatarColor: '#654321',
    avatarUrl: 'https://example.com/avatar.png',
  },
]

type AnyCol = Record<string, unknown>

function getCols(): AnyCol[] {
  return buildRestaurantsColumns(categoryOptions) as unknown as AnyCol[]
}

describe('buildRestaurantsColumns', () => {
  it('renders the full table with all columns and rows', () => {
    const cols = getCols()
    renderWithProviders(
      <Table columns={cols as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('Alpha Bistro')).toBeInTheDocument()
    expect(screen.getByText('Beta Diner')).toBeInTheDocument()
    expect(screen.getByText('Karachi')).toBeInTheDocument()
    expect(screen.getByText('Lahore')).toBeInTheDocument()
    expect(screen.getByText('Premium')).toBeInTheDocument()
    expect(screen.getByText('Standard')).toBeInTheDocument()
    expect(screen.getByText('120')).toBeInTheDocument()
    expect(screen.getByText('45')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })

  it('city column is server-sortable and uses a search-field dropdown (not a checkbox filter)', () => {
    const cols = getCols()
    const city = cols.find((c) => c.key === 'city') as {
      sorter: boolean
      filters?: unknown
      filterDropdown: unknown
      filterIcon: (filtered: boolean) => IconElement
    }
    expect(city.sorter).toBe(true)
    expect(city.filters).toBeUndefined()
    expect(typeof city.filterDropdown).toBe('function')
    expect(city.filterIcon(true).props.weight).toBe('fill')
    expect(city.filterIcon(false).props.weight).toBe('regular')
  })

  it('category column is server-sortable, uses category filters and falls back color', () => {
    const cols = getCols()
    const category = cols.find((c) => c.key === 'category') as {
      sorter: boolean
      filters: { text: string; value: string }[]
      render: (cat: string) => BadgeElement
    }
    expect(category.sorter).toBe(true)
    expect(category.filters).toEqual(categoryOptions)
    const unknown = category.render('Mystery')
    expect(unknown.props.children).toBe('Mystery')
    expect(unknown.props.style.background).toBe('var(--tint-neutral-bg)')
    const known = category.render('Premium')
    expect(known.props.style.background).toBe('var(--tint-teal-bg)')
  })

  it('bookings column is server-sortable and renders with toLocaleString', () => {
    const cols = getCols()
    const bookings = cols.find((c) => c.key === 'bookings') as {
      sorter: boolean
      render: (n: number) => BadgeElement
    }
    expect(bookings.sorter).toBe(true)
    const rendered = bookings.render(1234)
    expect(rendered.props.children).toBe('1,234')
  })

  it('status column is server-sortable, exposes filters and renders known/unknown statuses', () => {
    const cols = getCols()
    const status = cols.find((c) => c.key === 'status') as {
      sorter: boolean
      filters: { text: string; value: string }[]
      render: (status: string) => BadgeElement
    }
    expect(status.sorter).toBe(true)
    // CR-45 AC-2 — the API 422s on anything outside this allow-list, so offering
    // Pending or Rejected here would turn a filter click into a hard error.
    expect(status.filters.map((f) => f.value)).toEqual(['ACTIVE', 'SUSPENDED'])
    expect(status.filters.map((f) => f.value)).not.toContain('PENDING')
    expect(status.filters.map((f) => f.value)).not.toContain('REJECTED')
    expect(status.filters.map((f) => f.value)).not.toContain('DRAFT')
    expect(status.filters.map((f) => f.text)).toEqual(['Active', 'Suspended'])

    const known = status.render('ACTIVE')
    expect(known.props.children).toBe('Active')
    expect(known.props.style.background).toBe('#1A8A5A')

    const unknown = status.render('WEIRD')
    expect(unknown.props.children).toBe('WEIRD')
    expect(unknown.props.style.background).toBe('var(--color-text-secondary)')
  })

  it('actions column: change category always shown, suspend for ACTIVE, unsuspend for SUSPENDED', () => {
    const onSuspend = vi.fn()
    const onUnsuspend = vi.fn()
    const onChangeCategory = vi.fn()
    const cols = buildRestaurantsColumns(
      categoryOptions,
      onSuspend,
      onUnsuspend,
      onChangeCategory,
    ) as unknown as AnyCol[]
    const { container } = renderWithProviders(
      <Table columns={cols as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    const dataRows = container.querySelectorAll('tbody tr.ant-table-row')
    expect(dataRows.length).toBe(2)

    const activeCells = dataRows[0].querySelectorAll('td')
    const activeActionsCell = activeCells[activeCells.length - 1]
    fireEvent.click(activeActionsCell)
    const activeClickable = Array.from(activeActionsCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && !d.querySelector('div'),
    )
    expect(activeClickable.length).toBe(2)
    fireEvent.click(activeClickable[0])
    expect(onChangeCategory).toHaveBeenCalledWith(rows[0])
    fireEvent.click(activeClickable[1])
    expect(onSuspend).toHaveBeenCalledWith(rows[0])
    expect(onUnsuspend).not.toHaveBeenCalled()

    const suspendedCells = dataRows[1].querySelectorAll('td')
    const suspendedActionsCell = suspendedCells[suspendedCells.length - 1]
    const suspendedClickable = Array.from(suspendedActionsCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && !d.querySelector('div'),
    )
    expect(suspendedClickable.length).toBe(2)
    fireEvent.click(suspendedClickable[1])
    expect(onUnsuspend).toHaveBeenCalledWith(rows[1])
  })

  it('actions column callbacks are optional (no-op when undefined)', () => {
    const cols = getCols()
    const { container } = renderWithProviders(
      <Table columns={cols as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    const dataRows = container.querySelectorAll('tbody tr.ant-table-row')
    const cells = dataRows[0].querySelectorAll('td')
    const actionsCell = cells[cells.length - 1]
    const clickable = Array.from(actionsCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && !d.querySelector('div'),
    )
    expect(() => {
      for (const el of clickable) fireEvent.click(el)
    }).not.toThrow()
  })

  it('handles a PENDING status row not covered by ACTIVE/SUSPENDED action buttons', () => {
    const pendingRow: Restaurant = { ...rows[0], id: '3', status: 'PENDING' }
    const cols = getCols()
    const { container } = renderWithProviders(
      <Table columns={cols as never} dataSource={[pendingRow]} rowKey="id" pagination={false} />,
    )
    const dataRows = container.querySelectorAll('tbody tr.ant-table-row')
    const cells = dataRows[0].querySelectorAll('td')
    const actionsCell = cells[cells.length - 1]
    const clickable = Array.from(actionsCell.querySelectorAll('div')).filter(
      (d) => d.querySelector('svg') && !d.querySelector('div'),
    )
    expect(clickable.length).toBe(1)
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('sorts via clicking every column header without throwing', async () => {
    const cols = getCols()
    renderWithProviders(
      <Table columns={cols as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    for (const h of headers) {
      await user.click(h)
      await user.click(h)
      await user.click(h)
    }
  })

  it('opens filter dropdowns for city, category and status without throwing', async () => {
    const cols = getCols()
    renderWithProviders(
      <Table columns={cols as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    for (const trigger of Array.from(filterTriggers)) {
      await user.click(trigger as HTMLElement)
      fireEvent.keyDown(document.body, { key: 'Escape', code: 'Escape' })
    }
  })
})

describe('buildRestaurantNameColumn', () => {
  const t = i18n.t.bind(i18n)

  it('renders avatar image when avatarUrl present', () => {
    const col = buildRestaurantNameColumn(t)
    renderWithProviders(
      <Table columns={[col] as never} dataSource={[rows[1]]} rowKey="id" pagination={false} />,
    )
    const img = screen.getByAltText('Beta Diner') as HTMLImageElement
    expect(img.src).toBe('https://example.com/avatar.png')
    expect(screen.getByText('Beta Diner')).toBeInTheDocument()
    expect(screen.getByText('Fast Food')).toBeInTheDocument()
  })

  it('renders initials fallback when avatarUrl missing (two-word name)', () => {
    const col = buildRestaurantNameColumn(t)
    renderWithProviders(
      <Table columns={[col] as never} dataSource={[rows[0]]} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('renders initials fallback for a single-word name', () => {
    const col = buildRestaurantNameColumn(t)
    const singleWord: Restaurant = { ...rows[0], id: '4', name: 'Zenith' }
    renderWithProviders(
      <Table columns={[col] as never} dataSource={[singleWord]} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('ZE')).toBeInTheDocument()
  })

  it('renders "??" initials fallback when the name has no alphabetic words', () => {
    const col = buildRestaurantNameColumn(t)
    const noAlpha: Restaurant = { ...rows[0], id: '5', name: '123 456' }
    renderWithProviders(
      <Table columns={[col] as never} dataSource={[noAlpha]} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('??')).toBeInTheDocument()
  })

  it('is server-sortable (sorter === true)', () => {
    const col = buildRestaurantNameColumn(t)
    expect(col.sorter).toBe(true)
  })

  it('filterIcon reflects filtered state', () => {
    const col = buildRestaurantNameColumn(t)
    const filterIcon = col.filterIcon as (filtered: boolean) => IconElement
    expect(filterIcon(true).props.weight).toBe('fill')
    expect(filterIcon(false).props.weight).toBe('regular')
  })

  it('filterDropdown (name search): input, enter key, reset and search button interactions', () => {
    const col = buildRestaurantNameColumn(t)
    const setSelectedKeys = vi.fn()
    const confirm = vi.fn()
    const clearFilters = vi.fn()
    const dropdown = col.filterDropdown as (props: {
      setSelectedKeys: (keys: React.Key[]) => void
      selectedKeys: React.Key[]
      confirm: () => void
      clearFilters?: () => void
    }) => React.ReactElement
    const { container } = renderWithProviders(
      dropdown({ setSelectedKeys, selectedKeys: [], confirm, clearFilters }),
    )
    const input = container.querySelector('input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Alpha' } })
    expect(setSelectedKeys).toHaveBeenCalledWith(['Alpha'])
    fireEvent.change(input, { target: { value: '' } })
    expect(setSelectedKeys).toHaveBeenCalledWith([])
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })
    expect(confirm).toHaveBeenCalled()

    const buttons = container.querySelectorAll('button')
    const resetBtn = Array.from(buttons).find((b) => /reset/i.test(b.textContent ?? ''))
    fireEvent.click(resetBtn as HTMLButtonElement)
    expect(clearFilters).toHaveBeenCalled()

    const searchBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b !== resetBtn && b.tagName === 'BUTTON' && !/reset/i.test(b.textContent ?? ''),
    )
    fireEvent.mouseEnter(searchBtn as HTMLButtonElement)
    fireEvent.mouseLeave(searchBtn as HTMLButtonElement)
    const callsBeforeSearchClick = confirm.mock.calls.length
    fireEvent.click(searchBtn as HTMLButtonElement)
    expect(confirm.mock.calls.length).toBeGreaterThan(callsBeforeSearchClick)
  })
})

describe('restaurantJoinedColumn', () => {
  function renderJoined(dataSource: Restaurant[]) {
    renderWithProviders(
      <Table
        columns={[restaurantJoinedColumn] as never}
        dataSource={dataSource}
        rowKey="id"
        pagination={false}
      />,
    )
  }

  it('renders formatted joined date for each row', () => {
    renderJoined(rows)
    expect(screen.getByText('15-01-2024')).toBeInTheDocument()
    expect(screen.getByText('20-03-2024')).toBeInTheDocument()
  })

  // The API returns joinedAt as a display-style "DD-MM-YYYY HH:mm" string, which
  // a bare dayjs() cannot parse — the column used to render "Invalid Date".
  it('formats a non-ISO "DD-MM-YYYY HH:mm" joinedDate instead of showing "Invalid Date"', () => {
    renderJoined([{ ...rows[0], joinedDate: '13-08-2026 11:21' }])
    expect(screen.getByText('13-08-2026')).toBeInTheDocument()
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
  })

  it.each([
    ['missing', undefined],
    ['null', null],
    ['empty', ''],
  ])('falls back to — instead of "Invalid Date" when joinedDate is %s', (_label, joinedDate) => {
    renderJoined([{ ...rows[0], joinedDate: joinedDate as unknown as string }])
    expect(screen.getByText('—')).toBeInTheDocument()
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
  })

  it('is server-sortable (sorter === true)', () => {
    expect(restaurantJoinedColumn.sorter).toBe(true)
  })
})

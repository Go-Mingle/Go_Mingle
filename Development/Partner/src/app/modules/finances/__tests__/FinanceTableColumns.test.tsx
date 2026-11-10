import { describe, it, expect, vi } from 'vitest'
import { Table } from 'antd'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18n from '../../../../locales/i18n'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { buildFinanceColumns } from '../components/FinanceTableColumns'
import type { ActiveLedgerState } from '../components/FinanceTableColumns'
import type { FinanceLedgerRow } from '../types'

const t = i18n.t.bind(i18n)

function row(overrides: Partial<FinanceLedgerRow> = {}): FinanceLedgerRow {
  return {
    bookingId: 'b-1',
    bookingRef: 'BK-10041',
    mingler: { id: 'm1', name: 'Sana Khan' },
    interestTable: { id: 'it1', name: 'Wine & Dine' },
    date: '2026-05-04',
    totalAmountPkr: 2012,
    mySharePkr: 1620,
    ...overrides,
  }
}

const IDLE: ActiveLedgerState = { range: null }

function renderGrid(
  handlers: {
    onMinglerClick?: (row: FinanceLedgerRow) => void
    onInterestTableClick?: (row: FinanceLedgerRow) => void
  } = {},
  active: ActiveLedgerState = IDLE,
  onRowClick = vi.fn(),
) {
  const columns = buildFinanceColumns(
    t,
    {
      onMinglerClick: handlers.onMinglerClick ?? vi.fn(),
      onInterestTableClick: handlers.onInterestTableClick ?? vi.fn(),
    },
    active,
  )
  const view = renderWithProviders(
    <Table<FinanceLedgerRow>
      columns={columns}
      dataSource={[row()]}
      rowKey="bookingId"
      pagination={false}
      onRow={(record) => ({ onClick: () => onRowClick(record) })}
    />,
  )
  return { ...view, onRowClick }
}

describe('finance columns — content', () => {
  it('renders exactly the six designed columns', () => {
    const columns = buildFinanceColumns(
      t,
      { onMinglerClick: vi.fn(), onInterestTableClick: vi.fn() },
      IDLE,
    )
    expect(columns.map((column) => column.key)).toEqual([
      'bookingRef',
      'mingler',
      'interestTable',
      'date',
      'totalAmountPkr',
      'mySharePkr',
    ])
  })

  it('renders the booking reference, names and date', () => {
    renderGrid()
    expect(screen.getByText('BK-10041')).toBeInTheDocument()
    expect(screen.getByText('Sana Khan')).toBeInTheDocument()
    expect(screen.getByText('Wine & Dine')).toBeInTheDocument()
    expect(screen.getByText('2026-05-04')).toBeInTheDocument()
  })

  it('formats both money columns in PKR', () => {
    renderGrid()
    expect(screen.getByText('PKR 2,012')).toBeInTheDocument()
    expect(screen.getByText('PKR 1,620')).toBeInTheDocument()
  })

  it('does not reformat the date into the portal-wide convention', () => {
    renderGrid()
    expect(screen.queryByText('04-05-2026')).not.toBeInTheDocument()
  })
})

describe('finance columns — sort and search affordances', () => {
  it('offers sorting on the four allowed columns only', () => {
    const columns = buildFinanceColumns(
      t,
      { onMinglerClick: vi.fn(), onInterestTableClick: vi.fn() },
      IDLE,
    )
    const sortable = columns.filter((column) => 'sorter' in column && column.sorter)
    expect(sortable.map((column) => column.key)).toEqual([
      'bookingRef',
      'mingler',
      'interestTable',
      'date',
    ])
  })

  /** The API rejects a money sort with a 422, so the affordance must not exist. */
  it('offers no sort on either money column', () => {
    const columns = buildFinanceColumns(
      t,
      { onMinglerClick: vi.fn(), onInterestTableClick: vi.fn() },
      IDLE,
    )
    const money = columns.filter((column) =>
      ['totalAmountPkr', 'mySharePkr'].includes(String(column.key)),
    )
    expect(money).toHaveLength(2)
    money.forEach((column) => {
      expect('sorter' in column && column.sorter).toBeFalsy()
      expect('filterDropdown' in column && column.filterDropdown).toBeFalsy()
    })
  })

  it('reflects the active server sort back into the header', () => {
    const columns = buildFinanceColumns(
      t,
      { onMinglerClick: vi.fn(), onInterestTableClick: vi.fn() },
      { sortBy: 'mingler', sortOrder: 'asc', range: null },
    )
    const mingler = columns.find((column) => column.key === 'mingler')
    const date = columns.find((column) => column.key === 'date')
    expect(mingler && 'sortOrder' in mingler && mingler.sortOrder).toBe('ascend')
    expect(date && 'sortOrder' in date && date.sortOrder).toBeNull()
  })

  it('maps a descending server sort to AntD descend', () => {
    const columns = buildFinanceColumns(
      t,
      { onMinglerClick: vi.fn(), onInterestTableClick: vi.fn() },
      { sortBy: 'date', sortOrder: 'desc', range: null },
    )
    const date = columns.find((column) => column.key === 'date')
    expect(date && 'sortOrder' in date && date.sortOrder).toBe('descend')
  })

  it('marks the searched column as filtered', () => {
    const columns = buildFinanceColumns(
      t,
      { onMinglerClick: vi.fn(), onInterestTableClick: vi.fn() },
      { searchField: 'bookingRef', search: 'BK-1', range: null },
    )
    const bookingRef = columns.find((column) => column.key === 'bookingRef')
    const mingler = columns.find((column) => column.key === 'mingler')
    expect(bookingRef && 'filteredValue' in bookingRef && bookingRef.filteredValue).toEqual([
      'BK-1',
    ])
    expect(mingler && 'filteredValue' in mingler && mingler.filteredValue).toBeNull()
  })

  it('marks the Date column filtered while a custom range is applied', () => {
    const columns = buildFinanceColumns(
      t,
      { onMinglerClick: vi.fn(), onInterestTableClick: vi.fn() },
      { range: { from: '2026-01-01', to: '2026-06-30' } },
    )
    const date = columns.find((column) => column.key === 'date')
    expect(date && 'filteredValue' in date && date.filteredValue).toEqual(['2026-01-01'])
  })
})

/**
 * BR-12 — the row opens the transaction modal, but the two link cells must not.
 * Without stopPropagation a click would fire both.
 */
describe('finance columns — row-click precedence', () => {
  it('opens the Mingler target without opening the row modal', async () => {
    const onMinglerClick = vi.fn()
    const { onRowClick } = renderGrid({ onMinglerClick })

    await userEvent.setup().click(screen.getByText('Sana Khan'))

    expect(onMinglerClick).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b-1' }))
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('opens the interest-table target without opening the row modal', async () => {
    const onInterestTableClick = vi.fn()
    const { onRowClick } = renderGrid({ onInterestTableClick })

    await userEvent.setup().click(screen.getByText('Wine & Dine'))

    expect(onInterestTableClick).toHaveBeenCalled()
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('opens the row modal when a non-link cell is clicked', async () => {
    const { onRowClick } = renderGrid()
    await userEvent.setup().click(screen.getByText('BK-10041'))
    expect(onRowClick).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 'b-1' }))
  })

  it('activates the links from the keyboard without bubbling to the row', () => {
    const onMinglerClick = vi.fn()
    const { onRowClick } = renderGrid({ onMinglerClick })
    const link = screen.getByText('Sana Khan')

    fireEvent.keyDown(link, { key: 'Enter' })
    expect(onMinglerClick).toHaveBeenCalledTimes(1)

    fireEvent.keyDown(link, { key: ' ' })
    expect(onMinglerClick).toHaveBeenCalledTimes(2)

    fireEvent.keyDown(link, { key: 'ArrowDown' })
    expect(onMinglerClick).toHaveBeenCalledTimes(2)
    expect(onRowClick).not.toHaveBeenCalled()
  })
})

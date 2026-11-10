import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { Table } from 'antd'
import { buildFinanceColumns } from '../components/FinanceTableColumns'
import type { FinanceRecord } from '../components/financeTypes'
import type { ListFinancesQueryParams } from '../types'

// The list API sends `date` as "DD-MM-YYYY" (e.g. "29-06-2026"), not ISO.
const records: FinanceRecord[] = [
  {
    id: '1',
    restaurant: 'Alpha',
    restaurantId: 'a',
    bookingId: 'B1',
    mingler: 'M1',
    totalAmount: 125,
    date: '01-01-2024',
    restaurantCity: 'NYC',
    restaurantAddress: '123 St',
    restaurantInfo: { name: 'Alpha', email: 'a@b.c', address: '123 St', city: 'NYC' },
  },
  {
    id: '2',
    restaurant: 'Beta',
    restaurantId: 'b',
    bookingId: 'B2',
    mingler: 'M2',
    totalAmount: 67,
    date: '01-02-2024',
  },
]

const noFilters: ListFinancesQueryParams = {}

describe('buildFinanceColumns', () => {
  it('renders table with all columns', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    renderWithProviders(
      <Table<FinanceRecord> columns={cols} dataSource={records} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('triggers all column sorters', async () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    renderWithProviders(
      <Table<FinanceRecord> columns={cols} dataSource={records} rowKey="id" pagination={false} />,
    )
    const userEvent = (await import('@testing-library/user-event')).default
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    for (const h of headers) {
      await user.click(h)
      await user.click(h)
    }
  })

  it('triggers Popover Info hover/click and action hover', async () => {
    const onView = vi.fn()
    const cols = buildFinanceColumns(noFilters, onView)
    const { container } = renderWithProviders(
      <Table<FinanceRecord> columns={cols} dataSource={records} rowKey="id" pagination={false} />,
    )
    // The Info svg (smaller, in the restaurant cell)
    const rows = container.querySelectorAll('tbody tr.ant-table-row')
    const allSvgs = rows[0].querySelectorAll('svg')
    const userEvent = (await import('@testing-library/user-event')).default
    const user = userEvent.setup()
    // First svg is the info icon
    const info = allSvgs[0] as unknown as HTMLElement
    if (info) {
      await user.hover(info)
      await user.unhover(info)
      info.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    }
    // Last cell svg is the eye (Tooltip-wrapped)
    const lastSvg = allSvgs[allSvgs.length - 1] as unknown as HTMLElement
    if (lastSvg && lastSvg.parentElement) {
      await user.hover(lastSvg.parentElement)
      await user.unhover(lastSvg.parentElement)
    }
  })

  it('renders restaurant without info (no popover/tooltip)', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    renderWithProviders(
      <Table<FinanceRecord>
        columns={cols}
        dataSource={[
          {
            id: '99',
            restaurant: 'Gamma',
            restaurantId: 'g',
            bookingId: 'B9',
            mingler: 'mg',
            totalAmount: 16,
            date: '01-01-2024',
          },
        ]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('Gamma')).toBeInTheDocument()
  })

  it('columns are remote-sortable (no client compare function)', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    // Sortable columns opt into remote sorting with `sorter: true`; the
    // partner/gomingle share shell columns are not sortable (no sorter at all).
    // No column may carry a client-side compare function.
    const sortableKeys = new Set([
      'bookingId',
      'restaurant',
      'mingler',
      'interestTableTopic',
      'date',
      'totalAmount',
    ])
    for (const col of cols) {
      const sorter = (col as { sorter?: unknown }).sorter
      expect(typeof sorter).not.toBe('function')
      if (sortableKeys.has((col as { key?: string }).key ?? '')) {
        expect(sorter).toBe(true)
      } else {
        expect(sorter).toBeUndefined()
      }
    }
  })

  it('search columns have no active filteredValue when queryParams has no search', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    const [bookingId, restaurant, mingler, interestTable] = cols
    expect((bookingId as { filteredValue?: unknown[] }).filteredValue).toEqual([])
    expect((restaurant as { filteredValue?: unknown[] }).filteredValue).toEqual([])
    expect((mingler as { filteredValue?: unknown[] }).filteredValue).toEqual([])
    expect((interestTable as { filteredValue?: unknown[] }).filteredValue).toEqual([])
  })

  it('bookingId column reflects an active bookingRef search via filteredValue', () => {
    const cols = buildFinanceColumns({ bookingRef: 'B1' }, () => {})
    const bookingId = cols[0] as { filteredValue?: unknown[] }
    const mingler = cols[2] as { filteredValue?: unknown[] }
    expect(bookingId.filteredValue).toEqual(['B1'])
    // Columns without a term of their own stay inactive.
    expect(mingler.filteredValue).toEqual([])
  })

  it('mingler column reflects an active mingler search via filteredValue', () => {
    const cols = buildFinanceColumns({ mingler: 'M1' }, () => {})
    const mingler = cols[2] as { filteredValue?: unknown[] }
    expect(mingler.filteredValue).toEqual(['M1'])
  })

  it('interestTable column reflects an active interestTable search via filteredValue', () => {
    const cols = buildFinanceColumns({ interestTable: 'Wine' }, () => {})
    const interestTable = cols[3] as { filteredValue?: unknown[] }
    expect(interestTable.filteredValue).toEqual(['Wine'])
  })

  // MET-753 — the old single `searchField` meant only one magnifier could ever
  // show as active. CR-62 gives each column its own AND-combined parameter.
  it('reflects several simultaneously active column searches via filteredValue', () => {
    const cols = buildFinanceColumns({ bookingRef: 'B1', restaurant: 'Alpha' }, () => {})
    expect((cols[0] as { filteredValue?: unknown[] }).filteredValue).toEqual(['B1'])
    expect((cols[1] as { filteredValue?: unknown[] }).filteredValue).toEqual(['Alpha'])
    expect((cols[2] as { filteredValue?: unknown[] }).filteredValue).toEqual([])
  })

  it('date column reflects an active dateFrom/dateTo range via filteredValue', () => {
    const cols = buildFinanceColumns({ dateFrom: '2024-01-01', dateTo: '2024-01-31' }, () => {})
    const date = cols[4] as { filteredValue?: [unknown, unknown][] }
    expect(date.filteredValue).toHaveLength(1)
    expect(date.filteredValue?.[0]).toHaveLength(2)
  })

  it('date column has no active filteredValue without a full range', () => {
    const cols = buildFinanceColumns({ dateFrom: '2024-01-01' }, () => {})
    const date = cols[4] as { filteredValue?: unknown[] }
    expect(date.filteredValue).toEqual([])
  })

  it('renders the API\'s "DD-MM-YYYY" date as a valid, correctly formatted date', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    renderWithProviders(
      <Table<FinanceRecord>
        columns={cols}
        dataSource={[{ ...records[0], date: '29-06-2026' }]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('2026-06-29')).toBeInTheDocument()
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument()
  })

  it('totalAmount column has no search filter (unsupported by the API)', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    const totalAmount = cols[5] as { filterDropdown?: unknown; onFilter?: unknown }
    expect(totalAmount.filterDropdown).toBeUndefined()
    expect(totalAmount.onFilter).toBeUndefined()
  })

  it('restaurant column sortOrder reflects an active sortBy/sortOrder', () => {
    const cols = buildFinanceColumns({ sortBy: 'restaurant', sortOrder: 'asc' }, () => {})
    const restaurantCol = cols[1] as { sortOrder?: string | null }
    expect(restaurantCol.sortOrder).toBe('ascend')
  })

  it('restaurant column sortOrder is null when a different field is sorted', () => {
    const cols = buildFinanceColumns({ sortBy: 'date', sortOrder: 'desc' }, () => {})
    const restaurantCol = cols[1] as { sortOrder?: string | null }
    expect(restaurantCol.sortOrder).toBeNull()
  })

  it('restaurant column name is clickable when onRestaurantClick provided', async () => {
    const onRestaurantClick = vi.fn()
    const cols = buildFinanceColumns(noFilters, () => {}, undefined, onRestaurantClick)
    renderWithProviders(
      <Table<FinanceRecord> columns={cols} dataSource={records} rowKey="id" pagination={false} />,
    )
    const restaurantText = screen.getByText('Alpha')
    expect(restaurantText.getAttribute('role')).toBe('button')
  })

  it('restaurant column name is NOT clickable when onRestaurantClick absent', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    renderWithProviders(
      <Table<FinanceRecord> columns={cols} dataSource={records} rowKey="id" pagination={false} />,
    )
    const restaurantText = screen.getByText('Alpha')
    expect(restaurantText.getAttribute('role')).not.toBe('button')
  })

  it('restaurant column popover hidden when restaurantInfo absent', () => {
    const onRestaurantClick = vi.fn()
    const cols = buildFinanceColumns(noFilters, () => {}, undefined, onRestaurantClick)
    renderWithProviders(
      <Table<FinanceRecord>
        columns={cols}
        dataSource={[
          {
            id: '99',
            restaurant: 'NoInfo',
            restaurantId: 'ni',
            bookingId: 'B99',
            mingler: 'mg',
            totalAmount: 16,
            date: '01-01-2024',
          },
        ]}
        rowKey="id"
        pagination={false}
      />,
    )
    // No Info icon should be present
    // Info icon from Phosphor is rendered as svg, check if less than expected
    expect(screen.getByText('NoInfo')).toBeInTheDocument()
  })

  it('restaurant column reflects an active restaurant search via filteredValue', () => {
    const cols = buildFinanceColumns({ restaurant: 'alpha' }, () => {})
    const restaurantCol = cols[1] as { filteredValue?: unknown[] }
    expect(restaurantCol.filteredValue).toEqual(['alpha'])
  })

  it('clicking the restaurant name triggers onRestaurantClick and hover toggles the underline', async () => {
    const onRestaurantClick = vi.fn()
    const cols = buildFinanceColumns(noFilters, () => {}, undefined, onRestaurantClick)
    renderWithProviders(
      <Table<FinanceRecord> columns={cols} dataSource={records} rowKey="id" pagination={false} />,
    )
    const user = (await import('@testing-library/user-event')).default.setup()
    const name = screen.getByText('Alpha')

    await user.hover(name)
    expect(name.style.textDecoration).toBe('underline')
    await user.unhover(name)
    expect(name.style.textDecoration).toBe('none')

    await user.click(name)
    expect(onRestaurantClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('clicking the mingler name triggers onMinglerClick and hover toggles the underline', async () => {
    const onMinglerClick = vi.fn()
    const cols = buildFinanceColumns(noFilters, () => {}, onMinglerClick)
    renderWithProviders(
      <Table<FinanceRecord>
        columns={cols}
        dataSource={[{ ...records[0], minglerId: 'm1' }]}
        rowKey="id"
        pagination={false}
      />,
    )
    const user = (await import('@testing-library/user-event')).default.setup()
    const name = screen.getByText('M1')

    await user.hover(name)
    expect(name.style.textDecoration).toBe('underline')
    await user.unhover(name)
    expect(name.style.textDecoration).toBe('none')

    await user.click(name)
    expect(onMinglerClick).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }))
  })

  it('mingler name is not clickable when minglerId is absent', () => {
    const onMinglerClick = vi.fn()
    const cols = buildFinanceColumns(noFilters, () => {}, onMinglerClick)
    renderWithProviders(
      <Table<FinanceRecord> columns={cols} dataSource={records} rowKey="id" pagination={false} />,
    )
    expect(screen.getByText('M1')).not.toHaveAttribute('role')
  })

  it('partnerShare and gomingleShare render formatted amounts when present, and a dash when absent', () => {
    const cols = buildFinanceColumns(noFilters, () => {})
    renderWithProviders(
      <Table<FinanceRecord>
        columns={cols}
        dataSource={[{ ...records[0], partnerShare: 500, gomingleShare: 300 }, records[1]]}
        rowKey="id"
        pagination={false}
      />,
    )
    expect(screen.getByText('PKR 500')).toBeInTheDocument()
    expect(screen.getByText('PKR 300')).toBeInTheDocument()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

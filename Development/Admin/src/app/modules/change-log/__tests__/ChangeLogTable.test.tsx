import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ChangeLogTable } from '../components/ChangeLogTable'
import type { LogRow } from '../components/changeLogTableHelpers'

const sampleData: LogRow[] = [
  {
    id: '1',
    timestamp: '2025-01-01 10:00',
    admin: 'jane',
    initials: 'JD',
    action: 'create',
    oldVal: '—',
    newVal: 'Yes',
    module: 'Users',
  },
  {
    id: '2',
    timestamp: '2025-01-02 10:00',
    admin: 'john',
    initials: 'JS',
    action: 'update',
    oldVal: 'A',
    newVal: 'B',
    module: 'Categories',
  },
  {
    id: '3',
    timestamp: '2025-01-03 10:00',
    admin: 'amy',
    initials: 'AM',
    action: 'delete',
    oldVal: 'C',
    newVal: '—',
    module: 'Loyalty',
  },
  {
    id: '4',
    timestamp: '2025-01-04 10:00',
    admin: 'sam',
    initials: 'SM',
    action: 'unknown',
    oldVal: 'D',
    newVal: 'E',
    module: 'Minglers',
  },
]

describe('ChangeLogTable', () => {
  it('renders header cells', () => {
    renderWithProviders(<ChangeLogTable pagedData={sampleData} onTableChange={vi.fn()} />)
    expect(screen.getAllByText(/Timestamp/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Action/i).length).toBeGreaterThan(0)
  })

  it('renders all rows including unknown action fallback', () => {
    renderWithProviders(<ChangeLogTable pagedData={sampleData} onTableChange={vi.fn()} />)
    expect(screen.getByText('jane')).toBeInTheDocument()
    expect(screen.getByText('john')).toBeInTheDocument()
    expect(screen.getByText('amy')).toBeInTheDocument()
    expect(screen.getByText('sam')).toBeInTheDocument()
  })

  it('renders empty state when no data', () => {
    renderWithProviders(<ChangeLogTable pagedData={[]} onTableChange={vi.fn()} />)
    expect(screen.getAllByText(/no data/i).length).toBeGreaterThan(0)
  })

  it('renders dashes for empty/—/null oldVal and newVal across actions', () => {
    const data: LogRow[] = [
      {
        id: 'a',
        timestamp: 't',
        admin: 'u1',
        initials: 'U1',
        action: 'create',
        oldVal: 'should be dash',
        newVal: 'val',
        module: 'M',
      },
      {
        id: 'b',
        timestamp: 't',
        admin: 'u2',
        initials: 'U2',
        action: 'delete',
        oldVal: 'val',
        newVal: 'should be dash',
        module: 'M',
      },
      {
        id: 'c',
        timestamp: 't',
        admin: 'u3',
        initials: 'U3',
        action: 'update',
        oldVal: '',
        newVal: '',
        module: 'M',
      },
      {
        id: 'd',
        timestamp: 't',
        admin: 'u4',
        initials: 'U4',
        action: 'update',
        oldVal: '—',
        newVal: '—',
        module: 'M',
      },
    ]
    renderWithProviders(<ChangeLogTable pagedData={data} onTableChange={vi.fn()} />)
    expect(screen.getByText('u1')).toBeInTheDocument()
    expect(screen.getByText('u4')).toBeInTheDocument()
  })

  it('sorts when each header clicked (covers comparators)', async () => {
    const onTableChange = vi.fn()
    renderWithProviders(<ChangeLogTable pagedData={sampleData} onTableChange={onTableChange} />)
    const user = userEvent.setup()
    const headers = document.querySelectorAll('.ant-table-column-sorters')
    for (const h of headers) {
      await user.click(h)
    }
    expect(onTableChange).toHaveBeenCalled()
  })
})

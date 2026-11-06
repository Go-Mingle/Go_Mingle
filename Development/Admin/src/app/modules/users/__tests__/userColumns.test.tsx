import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Table } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { buildUserColumns } from '../userColumns'

const rows = [
  {
    id: '1',
    name: 'Alice',
    initials: 'AL',
    role: 'Super Admin',
    status: 'ACTIVE',
    lastActive: '2024-01-01',
  },
  {
    id: '2',
    name: 'Bob',
    initials: 'BO',
    role: 'Finance Manager',
    status: 'SUSPENDED',
    lastActive: '2024-02-01',
  },
]

describe('buildUserColumns', () => {
  it('renders rows and triggers edit/delete', () => {
    const onEdit = vi.fn()
    const onDelete = vi.fn()
    const cols = buildUserColumns({ onEdit, onDelete })
    const { container } = renderWithProviders(
      <Table columns={cols as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    const rowsEl = container.querySelectorAll('tbody tr.ant-table-row')
    const cells = rowsEl[0].querySelectorAll('td')
    const lastCell = cells[cells.length - 1]
    const buttons = lastCell.querySelectorAll('button')
    fireEvent.click(buttons[0])
    fireEvent.click(buttons[1])
    expect(onEdit).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it('filter onFilter logic', () => {
    const cols = buildUserColumns({ onEdit: () => {}, onDelete: () => {} })
    const role = cols[1] as { onFilter: (v: unknown, r: Record<string, unknown>) => boolean }
    expect(role.onFilter('Super Admin', rows[0])).toBe(true)
    expect(role.onFilter('Other', rows[0])).toBe(false)
    const status = cols[2] as { onFilter: (v: unknown, r: Record<string, unknown>) => boolean }
    expect(status.onFilter('ACTIVE', rows[0])).toBe(true)
    expect(status.onFilter('SUSPENDED', rows[0])).toBe(false)
  })

  it('sort headers click', async () => {
    const cols = buildUserColumns({ onEdit: () => {}, onDelete: () => {} })
    renderWithProviders(
      <Table columns={cols as never} dataSource={rows} rowKey="id" pagination={false} />,
    )
    const user = userEvent.setup()
    for (const h of screen.getAllByRole('columnheader')) {
      await user.click(h)
      await user.click(h)
    }
  })
})

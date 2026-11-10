import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { UsersTable } from '../components/UsersTable'

const data = [
  {
    id: '1',
    fullName: 'Alice',
    email: 'alice@test.com',
    role: { id: 'r1', name: 'Admin', fullAccess: true },
    status: 'ACTIVE' as const,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    fullName: 'Bob',
    email: 'bob@test.com',
    role: { id: 'r2', name: 'User', fullAccess: false },
    status: 'SUSPENDED' as const,
    createdAt: '2024-02-15',
  },
]

describe('UsersTable', () => {
  it('renders rows and triggers actions', () => {
    const onEdit = vi.fn()
    const onReset = vi.fn()
    const onDel = vi.fn()
    const { container } = renderWithProviders(
      <UsersTable
        data={data}
        onEdit={onEdit}
        onResetPassword={onReset}
        onDelete={onDel}
        onQueryParamsChange={() => {}}
      />,
    )
    expect(screen.getByText('Alice')).toBeInTheDocument()
    const rows = container.querySelectorAll('tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1])
    fireEvent.click(innerMost[2])
    expect(onReset).toHaveBeenCalled()
    expect(onDel).toHaveBeenCalled()
  })

  it('renders status with unknown variant fallback', () => {
    renderWithProviders(
      <UsersTable
        data={[
          {
            id: '3',
            fullName: 'X',
            email: 'x@test.com',
            role: { id: 'r1', name: 'Admin', fullAccess: false },
            status: 'PENDING' as 'ACTIVE',
            createdAt: '2024-01-01',
          },
        ]}
        onEdit={() => {}}
        onResetPassword={() => {}}
        onDelete={() => {}}
        onQueryParamsChange={() => {}}
      />,
    )
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('triggers onQueryParamsChange when sorting', async () => {
    const onQueryParamsChange = vi.fn()
    renderWithProviders(
      <UsersTable
        data={data}
        onEdit={() => {}}
        onResetPassword={() => {}}
        onDelete={() => {}}
        onQueryParamsChange={onQueryParamsChange}
      />,
    )
    await userEvent.setup().click(screen.getAllByRole('columnheader')[0])
    expect(onQueryParamsChange).toHaveBeenCalled()
  })

  it('exercises filter dropdowns', async () => {
    const onQueryParamsChange = vi.fn()
    const { container } = renderWithProviders(
      <UsersTable
        data={data}
        onEdit={() => {}}
        onResetPassword={() => {}}
        onDelete={() => {}}
        onQueryParamsChange={onQueryParamsChange}
      />,
    )
    const user = userEvent.setup()
    const filterTriggers = container.querySelectorAll('.ant-table-filter-trigger')
    if (filterTriggers[0]) {
      await user.click(filterTriggers[0] as HTMLElement)
      const input = await screen.findByPlaceholderText(/search/i)
      await user.type(input, 'Alice')
      await user.keyboard('{Enter}')
    }
  })

  it('clicks sort on all headers', async () => {
    renderWithProviders(
      <UsersTable
        data={data}
        onEdit={() => {}}
        onResetPassword={() => {}}
        onDelete={() => {}}
        onQueryParamsChange={() => {}}
      />,
    )
    const user = userEvent.setup()
    for (const h of screen.getAllByRole('columnheader')) {
      await user.click(h)
      await user.click(h)
    }
  })
})

import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { PendingTable } from '../components/PendingTable'
import type { Application } from '../types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockData: Application[] = [
  {
    id: '1',
    name: 'Pizza Palace',
    cuisine: 'Italian',
    owner: 'John Doe',
    phone: '123456789',
    email: 'john@test.com',
    city: 'Karachi',
    submitted: '01-01-2024',
    status: 'PENDING',
  },
]

describe('PendingTable', () => {
  it('renders headers, data and raw submitted date', () => {
    renderWithProviders(
      <PendingTable
        data={mockData}
        onQueryParamsChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )
    expect(screen.getByRole('columnheader', { name: 'Restaurant' })).toBeInTheDocument()
    expect(screen.getByText('Pizza Palace')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('01-01-2024')).toBeInTheDocument()
  })

  it('renders — for empty phone/email', () => {
    const data: Application[] = [{ ...mockData[0], phone: '', email: '' }]
    renderWithProviders(
      <PendingTable
        data={data}
        onQueryParamsChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('fires approve and reject without navigating', () => {
    const onApprove = vi.fn()
    const onReject = vi.fn()
    renderWithProviders(
      <PendingTable
        data={mockData}
        onQueryParamsChange={vi.fn()}
        onApprove={onApprove}
        onReject={onReject}
      />,
    )
    const lastCell = document.querySelector('tbody tr.ant-table-row td:last-child')
    const svgs = lastCell!.querySelectorAll('svg')
    fireEvent.click(svgs[0].closest('div') as HTMLElement)
    fireEvent.click(svgs[1].closest('div') as HTMLElement)
    expect(onApprove).toHaveBeenCalledWith(mockData[0])
    expect(onReject).toHaveBeenCalledWith(mockData[0])
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('navigates when a row body is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(
      <PendingTable
        data={mockData}
        onQueryParamsChange={vi.fn()}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )
    await user.click(container.querySelector('tbody tr.ant-table-row td') as HTMLElement)
    expect(mockNavigate).toHaveBeenCalledWith(
      '/approval-queue/1',
      expect.objectContaining({ state: expect.objectContaining({ fromApproval: true }) }),
    )
  })

  it('calls onQueryParamsChange when a sortable header is clicked', () => {
    const onQueryParamsChange = vi.fn()
    renderWithProviders(
      <PendingTable
        data={mockData}
        onQueryParamsChange={onQueryParamsChange}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )
    const header = document.querySelector('.ant-table-thead th.ant-table-column-has-sorters')
    fireEvent.click(header as HTMLElement)
    expect(onQueryParamsChange).toHaveBeenCalled()
  })

  it('surfaces a city search to the city query param', async () => {
    const onQueryParamsChange = vi.fn()
    renderWithProviders(
      <PendingTable
        data={mockData}
        onQueryParamsChange={onQueryParamsChange}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    // Columns with a search filter, in order: restaurant[0], owner[1], city[2].
    const triggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(triggers[2] as HTMLElement)
    const input = await screen.findByPlaceholderText('Search city…')
    await user.type(input, 'Karachi')
    await user.keyboard('{Enter}')
    expect(onQueryParamsChange).toHaveBeenCalledWith(expect.objectContaining({ city: 'Karachi' }))
  })
})

import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RejectedTable } from '../components/RejectedTable'
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
    status: 'REJECTED',
    rejectedOn: '05-01-2024',
    rejectionReason: 'This is a long rejection reason that should have a tooltip',
  },
  {
    id: '2',
    name: 'Burger King',
    cuisine: 'Fast Food',
    owner: 'Jane Smith',
    phone: '987654321',
    email: 'jane@test.com',
    city: 'Lahore',
    submitted: '02-01-2024',
    status: 'REJECTED',
    rejectedOn: '06-01-2024',
    rejectionReason: 'Short reason',
  },
]

describe('RejectedTable', () => {
  it('renders all column headers', () => {
    renderWithProviders(<RejectedTable data={mockData} onQueryParamsChange={vi.fn()} />)
    expect(screen.getByRole('columnheader', { name: 'Restaurant' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Owner' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'City' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Submitted' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Rejected On' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Reason' })).toBeInTheDocument()
  })

  it('renders names, cuisines, owners and raw dates', () => {
    renderWithProviders(<RejectedTable data={mockData} onQueryParamsChange={vi.fn()} />)
    expect(screen.getByText('Pizza Palace')).toBeInTheDocument()
    expect(screen.getByText('Italian')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('01-01-2024')).toBeInTheDocument()
    expect(screen.getByText('05-01-2024')).toBeInTheDocument()
    expect(
      screen.getByText('This is a long rejection reason that should have a tooltip'),
    ).toBeInTheDocument()
  })

  it('renders — for a missing rejection date', () => {
    const data: Application[] = [{ ...mockData[0], rejectedOn: undefined }]
    renderWithProviders(<RejectedTable data={data} onQueryParamsChange={vi.fn()} />)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('navigates when a row is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(
      <RejectedTable data={mockData} onQueryParamsChange={vi.fn()} />,
    )
    const rows = container.querySelectorAll('tbody tr.ant-table-row')
    await user.click(rows[0])
    expect(mockNavigate).toHaveBeenCalledWith(
      '/approval-queue/1',
      expect.objectContaining({ state: expect.objectContaining({ fromApproval: true }) }),
    )
  })

  it('calls onQueryParamsChange when a sortable header is clicked', () => {
    const onQueryParamsChange = vi.fn()
    renderWithProviders(<RejectedTable data={mockData} onQueryParamsChange={onQueryParamsChange} />)
    const header = document.querySelector('.ant-table-thead th.ant-table-column-has-sorters')
    fireEvent.click(header as HTMLElement)
    expect(onQueryParamsChange).toHaveBeenCalled()
  })

  it('surfaces a city search to the city query param', async () => {
    const onQueryParamsChange = vi.fn()
    renderWithProviders(<RejectedTable data={mockData} onQueryParamsChange={onQueryParamsChange} />)
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

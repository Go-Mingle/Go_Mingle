import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ChangeLogPagination } from '../components/ChangeLogPagination'

describe('ChangeLogPagination', () => {
  it('renders showing range and current page', () => {
    renderWithProviders(
      <ChangeLogPagination
        currentPage={1}
        pageSize={25}
        total={100}
        startRecord={1}
        endRecord={25}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/1.*25.*100/)).toBeInTheDocument()
  })

  it('calls onPageChange when navigating', async () => {
    const onPageChange = vi.fn()
    renderWithProviders(
      <ChangeLogPagination
        currentPage={1}
        pageSize={25}
        total={100}
        startRecord={1}
        endRecord={25}
        onPageChange={onPageChange}
        onPageSizeChange={() => {}}
      />,
    )
    const user = userEvent.setup()
    const page2 = screen.getByTitle('2')
    await user.click(page2)
    expect(onPageChange).toHaveBeenCalled()
    expect(onPageChange.mock.calls[0][0]).toBe(2)
  })

  it('renders zero total without crashing', () => {
    renderWithProviders(
      <ChangeLogPagination
        currentPage={1}
        pageSize={25}
        total={0}
        startRecord={0}
        endRecord={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/0.*0/)).toBeInTheDocument()
  })
})

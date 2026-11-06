import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { PaginationRow } from '../components/PaginationRow'

describe('PaginationRow', () => {
  it('calls onPageSizeChange when a new page size is selected', async () => {
    const onPageSizeChange = vi.fn()
    renderWithProviders(
      <PaginationRow
        total={100}
        page={1}
        pageSize={10}
        onPageChange={vi.fn()}
        onPageSizeChange={onPageSizeChange}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('50 / page'))
    expect(onPageSizeChange).toHaveBeenCalledWith(50)
  })
})

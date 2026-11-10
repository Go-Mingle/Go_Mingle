import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { CategoriesPagination } from '../components/CategoriesPagination'

describe('CategoriesPagination', () => {
  it('renders showing text and triggers page change', async () => {
    const onPage = vi.fn()
    const onSize = vi.fn()
    renderWithProviders(
      <CategoriesPagination
        currentPage={1}
        pageSize={10}
        total={50}
        startRecord={1}
        endRecord={10}
        onPageChange={onPage}
        onPageSizeChange={onSize}
      />,
    )
    expect(screen.getByText(/1.*10.*50/)).toBeInTheDocument()
    const user = userEvent.setup()
    const next = screen.getByTitle('Next Page')
    await user.click(next)
    expect(onPage).toHaveBeenCalled()
  })

  it('changes page size via select', async () => {
    const onSize = vi.fn()
    renderWithProviders(
      <CategoriesPagination
        currentPage={1}
        pageSize={10}
        total={100}
        startRecord={1}
        endRecord={10}
        onPageChange={() => {}}
        onPageSizeChange={onSize}
      />,
    )
    const user = userEvent.setup()
    const select = screen.getByRole('combobox')
    await user.click(select)
    const options = await screen.findAllByText(/25 \/ page/i)
    await user.click(options[options.length - 1])
    expect(onSize).toHaveBeenCalled()
    expect(onSize.mock.calls[0][0]).toBe(25)
  })
})

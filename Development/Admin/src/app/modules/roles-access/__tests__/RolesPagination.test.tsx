import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RolesPagination } from '../components/RolesPagination'

describe('RolesPagination', () => {
  it('renders and changes page', async () => {
    const onPage = vi.fn()
    render(
      <RolesPagination
        currentPage={1}
        pageSize={10}
        total={30}
        startRecord={1}
        endRecord={10}
        onPageChange={onPage}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 1–10 of 30/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByTitle('Next Page'))
    expect(onPage).toHaveBeenCalled()
  })

  it('changes page size via select', async () => {
    const onSize = vi.fn()
    render(
      <RolesPagination
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
    await user.click(screen.getByRole('combobox'))
    const opts = await screen.findAllByText(/50 \/ page/i)
    await user.click(opts[opts.length - 1])
    expect(onSize).toHaveBeenCalled()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UsersPaginationRow } from '../components/UsersPaginationRow'

describe('UsersPaginationRow', () => {
  it('renders and triggers page change', async () => {
    const onPage = vi.fn()
    render(
      <UsersPaginationRow
        total={50}
        currentPage={1}
        pageSize={10}
        onPageChange={onPage}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 1–10 of 50/)).toBeInTheDocument()
    await userEvent.setup().click(screen.getByTitle('Next Page'))
    expect(onPage).toHaveBeenCalled()
  })

  it('total 0 startRecord 0', () => {
    render(
      <UsersPaginationRow
        total={0}
        currentPage={1}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 0–0/)).toBeInTheDocument()
  })

  it('changes page size', async () => {
    const onSize = vi.fn()
    render(
      <UsersPaginationRow
        total={100}
        currentPage={1}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={onSize}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('combobox'))
    const opts = await screen.findAllByText(/25 \/ page/i)
    await user.click(opts[opts.length - 1])
    expect(onSize).toHaveBeenCalled()
  })
})

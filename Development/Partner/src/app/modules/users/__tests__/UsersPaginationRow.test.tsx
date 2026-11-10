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
    // 25 rather than 20 — the API only accepts 10/25/50/100, so offering 20
    // would silently fall back to its default and make the control lie.
    const option = await screen.findByText('25 / page', {
      selector: '.ant-select-item-option-content',
    })
    await user.click(option)
    expect(onSize).toHaveBeenCalledWith(25)
  })

  it('offers exactly the page sizes the API accepts', async () => {
    render(
      <UsersPaginationRow
        total={100}
        currentPage={1}
        pageSize={25}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    await userEvent.setup().click(screen.getByRole('combobox'))
    const labels = Array.from(document.querySelectorAll('.ant-select-item-option-content')).map(
      (node) => node.textContent,
    )
    expect(labels).toEqual(['10 / page', '25 / page', '50 / page', '100 / page'])
  })
})

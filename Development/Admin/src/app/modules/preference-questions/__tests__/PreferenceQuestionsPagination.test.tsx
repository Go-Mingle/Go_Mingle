import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PreferenceQuestionsPagination } from '../components/PreferenceQuestionsPagination'

describe('PreferenceQuestionsPagination', () => {
  it('renders the showing summary and changes page', async () => {
    const onPage = vi.fn()
    render(
      <PreferenceQuestionsPagination
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

  it('changes page size via the select', async () => {
    const onSize = vi.fn()
    render(
      <PreferenceQuestionsPagination
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
    const opts = await screen.findAllByText(/25\/page/i)
    await user.click(opts[opts.length - 1])
    expect(onSize).toHaveBeenCalled()
  })

  it('renders a zeroed summary when there are no records', () => {
    render(
      <PreferenceQuestionsPagination
        currentPage={1}
        pageSize={10}
        total={0}
        startRecord={0}
        endRecord={0}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 0–0 of 0/)).toBeInTheDocument()
  })
})

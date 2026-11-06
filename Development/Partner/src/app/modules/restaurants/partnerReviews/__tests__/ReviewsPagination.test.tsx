import { describe, it, expect, afterEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { ReviewsPagination } from '../components/ReviewsPagination'

/**
 * Tested directly rather than only through the tab, because two of its states are
 * unreachable from there: the tab swaps in an empty state before the pager can render a
 * zero total, and the mobile variant hides the size selector entirely.
 */
function renderPager(overrides: Partial<Parameters<typeof ReviewsPagination>[0]> = {}) {
  const props = {
    isMobile: false,
    total: 42,
    currentPage: 1,
    pageSize: 10,
    onPageChange: vi.fn(),
    onPageSizeChange: vi.fn(),
    ...overrides,
  }
  return { props, ...renderWithProviders(<ReviewsPagination {...props} />) }
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('ReviewsPagination — desktop', () => {
  it('reports the range and the server total', () => {
    renderPager()
    expect(screen.getByText('Showing 1–10 of 42 results')).toBeInTheDocument()
  })

  it('reports the range for a later page', () => {
    renderPager({ currentPage: 3 })
    expect(screen.getByText('Showing 21–30 of 42 results')).toBeInTheDocument()
  })

  it('does not overshoot the total on the last, partial page', () => {
    renderPager({ currentPage: 5 })
    expect(screen.getByText('Showing 41–42 of 42 results')).toBeInTheDocument()
  })

  /** Reachable when a filter matches nothing but the summary keeps the tab populated. */
  it('starts the range at zero rather than one when nothing matches', () => {
    renderPager({ total: 0 })
    expect(screen.getByText('Showing 0–0 of 0 results')).toBeInTheDocument()
  })

  it('groups thousands in the total', () => {
    renderPager({ total: 1234 })
    expect(screen.getByText(/1,234 results/)).toBeInTheDocument()
  })

  it('asks for a new page', async () => {
    const { props } = renderPager()

    await userEvent.click(screen.getByTitle('2'))
    expect(vi.mocked(props.onPageChange).mock.calls[0][0]).toBe(2)
  })

  /**
   * Only 10/25/50. The shared `UsersPagination` offers 100 as well, which this endpoint
   * refuses — the reason this pager exists at all.
   */
  it('offers exactly the three page sizes the endpoint accepts', async () => {
    renderPager()

    await userEvent.click(screen.getAllByRole('combobox')[0])
    for (const size of ['25 / page', '50 / page']) {
      expect(
        await screen.findByText(size, { selector: '.ant-select-item-option-content' }),
      ).toBeInTheDocument()
    }
    expect(screen.queryByText('100 / page')).not.toBeInTheDocument()
  })

  it('passes the chosen size through without AntD’s option object', async () => {
    const { props } = renderPager()

    await userEvent.click(screen.getAllByRole('combobox')[0])
    await userEvent.click(
      await screen.findByText('50 / page', { selector: '.ant-select-item-option-content' }),
    )

    expect(props.onPageSizeChange).toHaveBeenCalledWith(50)
  })
})

describe('ReviewsPagination — mobile', () => {
  it('renders only the pager, with no range text or size selector', () => {
    renderPager({ isMobile: true })

    expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    expect(screen.getByTitle('2')).toBeInTheDocument()
  })

  it('still asks for a new page', async () => {
    const { props } = renderPager({ isMobile: true })

    await userEvent.click(screen.getByTitle('2'))
    expect(vi.mocked(props.onPageChange).mock.calls[0][0]).toBe(2)
  })
})

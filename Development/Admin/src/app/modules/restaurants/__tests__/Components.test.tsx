import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Storefront } from '@phosphor-icons/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { EmptyStateCard } from '../components/EmptyStateCard'
import { OverviewField } from '../components/OverviewField'
import { ActionBtn } from '../components/RestaurantActionBtn'
import { ReviewsSummaryCard } from '../components/ReviewsSummaryCard'
import { DownloadBtn } from '../components/MediaDownloadBtn'
import { ChangeCategoryModal } from '../ChangeCategoryModal'
import { RestaurantSuspendModal } from '../components/RestaurantSuspendModal'
import { RestaurantUnsuspendModal } from '../components/RestaurantUnsuspendModal'
import { RestaurantsPagination } from '../components/RestaurantsPagination'

describe('EmptyStateCard', () => {
  it('renders', () => {
    render(<EmptyStateCard title="T" IconComp={Storefront} message="No data" />)
    expect(screen.getByText('T')).toBeInTheDocument()
    expect(screen.getByText('No data')).toBeInTheDocument()
  })
})

describe('OverviewField (restaurants)', () => {
  it('renders', () => {
    render(<OverviewField IconComp={Storefront} label="L" value="value" />)
    expect(screen.getByText('L')).toBeInTheDocument()
  })
})

describe('ActionBtn', () => {
  it('renders, click and hover', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <ActionBtn tooltip="t" hoverBg="r" hoverColor="b" onClick={onClick}>
        x
      </ActionBtn>,
    )
    const div = container.querySelector('div')!
    const user = userEvent.setup()
    await user.hover(div)
    await user.unhover(div)
    await user.click(div)
    expect(onClick).toHaveBeenCalled()
  })

  it('disabled prevents click and hover handlers', async () => {
    const onClick = vi.fn()
    const { container } = render(
      <ActionBtn tooltip="t" hoverBg="r" hoverColor="b" onClick={onClick} disabled>
        x
      </ActionBtn>,
    )
    const div = container.querySelector('div')!
    await userEvent.setup().click(div)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('ReviewsSummaryCard', () => {
  it('renders rating and breakdown', () => {
    const reviews = [
      { id: '1', rating: 5, author: 'A', date: 'd', text: 't' },
      { id: '2', rating: 4, author: 'B', date: 'd', text: 't' },
      { id: '3', rating: 3, author: 'C', date: 'd', text: 't' },
      { id: '4', rating: 1, author: 'D', date: 'd', text: 't' },
    ]
    renderWithProviders(
      <ReviewsSummaryCard reviews={reviews as never} avgRating={4.5} totalReviews={4} />,
    )
    expect(screen.getByText('4.5')).toBeInTheDocument()
  })

  it('renders with 1 review', () => {
    renderWithProviders(
      <ReviewsSummaryCard reviews={[{ rating: 5 }] as never} avgRating={5} totalReviews={1} />,
    )
  })
})

describe('DownloadBtn (restaurants media)', () => {
  it('downloads via fetch+blob on click and toggles hover', async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn(),
    })
    const blob = new Blob(['data'])
    const fetchSpy = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, blob: () => Promise.resolve(blob) })
    vi.stubGlobal('fetch', fetchSpy)
    const { container } = render(<DownloadBtn url="https://files.test/a.pdf" filename="a.pdf" />)
    const div = container.querySelector('div')!
    const user = userEvent.setup()
    await user.hover(div)
    await user.unhover(div)
    await user.click(div)
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledWith('https://files.test/a.pdf'))
    await waitFor(() => expect(clickSpy).toHaveBeenCalled())
    vi.unstubAllGlobals()
  })
})

describe('ChangeCategoryModal', () => {
  it('renders and triggers close + confirm', async () => {
    const onClose = vi.fn()
    const onConfirm = vi.fn()
    renderWithProviders(
      <ChangeCategoryModal
        open
        currentCategoryId="A"
        newCategoryId="B"
        onCategoryChange={() => {}}
        categoryOptions={[
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ]}
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('confirm disabled when same category', () => {
    renderWithProviders(
      <ChangeCategoryModal
        open
        currentCategoryId="A"
        newCategoryId="A"
        onCategoryChange={() => {}}
        categoryOptions={[]}
        onClose={() => {}}
        onConfirm={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const change = buttons.find((b) => /change category/i.test(b.textContent ?? ''))
    expect(change).toBeDisabled()
  })

  it('disables the confirm button and shows a spinner while confirmLoading', () => {
    renderWithProviders(
      <ChangeCategoryModal
        open
        currentCategoryId="A"
        newCategoryId="B"
        onCategoryChange={() => {}}
        categoryOptions={[
          { value: 'A', label: 'A' },
          { value: 'B', label: 'B' },
        ]}
        onClose={() => {}}
        onConfirm={() => {}}
        confirmLoading
      />,
    )
    const change = screen
      .getAllByRole('button')
      .find((b) => /change category/i.test(b.textContent ?? '')) as HTMLElement
    expect(change).toBeDisabled()
    expect(change.querySelector('.animate-spin')).toBeTruthy()
  })
})

describe('RestaurantSuspendModal', () => {
  it('does not render content when closed', () => {
    renderWithProviders(
      <RestaurantSuspendModal
        open={false}
        restaurantName="X"
        reason=""
        onReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.queryByText(/suspend restaurant/i)).not.toBeInTheDocument()
  })

  it('disabled until reason >= 10 chars', () => {
    renderWithProviders(
      <RestaurantSuspendModal
        open
        restaurantName="X"
        reason="short"
        onReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /^suspend$/i.test(b.textContent ?? ''))
    expect(confirm).toBeDisabled()
  })

  it('confirm enabled and fires when reason valid; cancel fires', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <RestaurantSuspendModal
        open
        restaurantName="X"
        reason="long enough reason here"
        onReasonChange={() => {}}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /^suspend$/i.test(b.textContent ?? ''))!
    expect(confirm).not.toBeDisabled()
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('typing updates reason via onReasonChange', async () => {
    const setReason = vi.fn()
    renderWithProviders(
      <RestaurantSuspendModal
        open
        restaurantName="X"
        reason=""
        onReasonChange={setReason}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const textareas = document.querySelectorAll('textarea')
    await userEvent.setup().type(textareas[0] as HTMLTextAreaElement, 'a')
    expect(setReason).toHaveBeenCalled()
  })

  it('hovers and unhovers the confirm button when enabled', async () => {
    renderWithProviders(
      <RestaurantSuspendModal
        open
        restaurantName="X"
        reason="long enough reason here"
        onReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /^suspend$/i.test(b.textContent ?? ''))!
    const user = userEvent.setup()
    await user.hover(confirm)
    expect(confirm.style.background).toBe('var(--color-error-bg-hover)')
    await user.unhover(confirm)
    expect(confirm.style.background).toBe('var(--color-error-bg)')
  })

  it('hovering and unhovering the confirm button when disabled does not change background', async () => {
    renderWithProviders(
      <RestaurantSuspendModal
        open
        restaurantName="X"
        reason="short"
        onReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /^suspend$/i.test(b.textContent ?? ''))!
    const user = userEvent.setup()
    await user.hover(confirm)
    expect(confirm.style.background).toBe('var(--color-error-bg)')
    await user.unhover(confirm)
    expect(confirm.style.background).toBe('var(--color-error-bg)')
  })

  it('renders without a restaurant name', () => {
    renderWithProviders(
      <RestaurantSuspendModal
        open
        restaurantName={undefined}
        reason=""
        onReasonChange={() => {}}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByText(/0\/10 characters minimum/i)).toBeInTheDocument()
  })
})

describe('RestaurantUnsuspendModal', () => {
  it('does not render content when closed', () => {
    renderWithProviders(
      <RestaurantUnsuspendModal
        open={false}
        restaurantName="X"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.queryByText(/unsuspend restaurant/i)).not.toBeInTheDocument()
  })

  it('renders and triggers confirm/cancel', async () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    renderWithProviders(
      <RestaurantUnsuspendModal
        open
        restaurantName="X"
        onCancel={onCancel}
        onConfirm={onConfirm}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    expect(onCancel).toHaveBeenCalled()
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /^unsuspend$/i.test(b.textContent ?? ''))!
    await user.click(confirm)
    expect(onConfirm).toHaveBeenCalled()
  })

  it('hovers and unhovers the confirm button', async () => {
    renderWithProviders(
      <RestaurantUnsuspendModal open restaurantName="X" onCancel={() => {}} onConfirm={() => {}} />,
    )
    const buttons = screen.getAllByRole('button')
    const confirm = buttons.find((b) => /^unsuspend$/i.test(b.textContent ?? ''))!
    const user = userEvent.setup()
    await user.hover(confirm)
    expect(confirm.style.background).toBe('var(--color-accent-dark)')
    await user.unhover(confirm)
    expect(confirm.style.background).toBe('var(--color-accent)')
  })

  it('renders without a restaurant name', () => {
    renderWithProviders(
      <RestaurantUnsuspendModal
        open
        restaurantName={undefined}
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    )
    expect(screen.getByRole('button', { name: /^unsuspend$/i })).toBeInTheDocument()
  })
})

describe('RestaurantsPagination', () => {
  it('renders and triggers page change', async () => {
    const onPage = vi.fn()
    renderWithProviders(
      <RestaurantsPagination
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
    renderWithProviders(
      <RestaurantsPagination
        total={0}
        currentPage={1}
        pageSize={10}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 0–0 of 0/)).toBeInTheDocument()
  })

  it('formats large totals with thousands separators', () => {
    renderWithProviders(
      <RestaurantsPagination
        total={12345}
        currentPage={2}
        pageSize={50}
        onPageChange={() => {}}
        onPageSizeChange={() => {}}
      />,
    )
    expect(screen.getByText(/Showing 51–100 of 12,345/)).toBeInTheDocument()
  })

  it('changes page size', async () => {
    const onSize = vi.fn()
    renderWithProviders(
      <RestaurantsPagination
        total={200}
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
    expect(onSize).toHaveBeenCalledWith(25)
  })
})

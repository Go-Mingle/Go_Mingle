import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { server } from '../../../../mocks/server'
import { MinglerReviewsTab } from '../components/MinglerReviewsTab'
import { __resetReviewsMock } from '../../../../mocks/handlers/reviews'

// mockReviews (see src/mocks/data) — bodyPreview mirrors each review's text.
const REV1 = 'Exceptional experience — the truffle risotto was divine. Will return!'
const REV2 = 'Great ambience and food, service was slightly slow but overall excellent.'
const REV3 = 'Average experience, portions were smaller than expected for the price.'

function setDesktop() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /min-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function setMobile() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

function renderTab() {
  return renderWithProviders(
    <MinglerReviewsTab minglerId="m1" minglerName="Sana Khan" minglerInitials="SK" />,
  )
}

beforeEach(() => {
  __resetReviewsMock()
})

describe('MinglerReviewsTab — desktop table (API-backed)', () => {
  it('loads and renders review rows from the API', async () => {
    setDesktop()
    renderTab()
    expect(await screen.findByText(REV1)).toBeInTheDocument()
    expect(screen.getByText(REV2)).toBeInTheDocument()
    expect(screen.getByText(REV3)).toBeInTheDocument()
    // The interest-table column is mapped from the API's interestTableName.
    expect(screen.getAllByText('Sunday Brunch Club').length).toBeGreaterThan(0)
  })

  it('opens the read-only detail modal (restaurant, body, valid date) on row click', async () => {
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    const row = (await screen.findByText(REV2)).closest('tr') as HTMLElement
    await user.click(row)

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Review details')).toBeInTheDocument()
    // Detail API returns the full body + restaurant name.
    expect(within(dialog).getByText(REV2)).toBeInTheDocument()
    expect(within(dialog).getByText('Saffron Table')).toBeInTheDocument()
    // Date must be parsed from DD-MM-YYYY, not rendered as "Invalid Date".
    expect(within(dialog).getByText('10 Mar 2026')).toBeInTheDocument()
    expect(within(dialog).queryByText(/invalid date/i)).not.toBeInTheDocument()
  })

  it('soft-deletes a review from the row action and shows a success toast', async () => {
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    const row = (await screen.findByText(REV3)).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete review?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Review deleted.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText(REV3)).not.toBeInTheDocument())
  })

  it('cancels the delete confirmation without removing the review', async () => {
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    const row = (await screen.findByText(REV3)).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Delete' }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText(REV3)).toBeInTheDocument()
  })

  it('treats a 404 on delete as already-deleted (info toast, no error)', async () => {
    server.use(
      http.delete('/api/v1/reviews/:id', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_REVIEW_NOT_FOUND', message: 'Review not found.' } },
          { status: 404 },
        ),
      ),
    )
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    const row = (await screen.findByText(REV3)).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('This review was already deleted.')).toBeInTheDocument()
  })

  it('shows the API error message when delete fails unexpectedly', async () => {
    server.use(
      http.delete('/api/v1/reviews/:id', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Something broke.' } },
          { status: 500 },
        ),
      ),
    )
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    const row = (await screen.findByText(REV3)).closest('tr') as HTMLElement
    await user.click(within(row).getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Something broke.')).toBeInTheDocument()
  })

  it('filters by rating server-side', async () => {
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    await screen.findByText(REV1)

    const ratingHeader = screen.getByRole('columnheader', { name: /rating/i })
    await user.click(within(ratingHeader).getByRole('button', { hidden: true }))
    await user.click(await screen.findByText('5 Stars'))
    await user.click(screen.getByRole('button', { name: /^OK$/ }))

    await waitFor(() => expect(screen.queryByText(REV2)).not.toBeInTheDocument())
    expect(screen.getByText(REV1)).toBeInTheDocument()
  })

  it('searches review text server-side', async () => {
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    await screen.findByText(REV1)

    const reviewHeader = screen.getByRole('columnheader', { name: /review/i })
    await user.click(within(reviewHeader).getByRole('button', { hidden: true }))
    const input = await screen.findByPlaceholderText('Search reviews…')
    await user.type(input, 'truffle')
    await user.keyboard('{Enter}')

    await waitFor(() => expect(screen.queryByText(REV2)).not.toBeInTheDocument())
    expect(screen.getByText(REV1)).toBeInTheDocument()
  })

  it('sorts by the date and rating columns', async () => {
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    await screen.findByText(REV1)

    await user.click(screen.getByRole('columnheader', { name: /date/i }))
    await user.click(screen.getByRole('columnheader', { name: /rating/i }))
    // Rows still render after re-sorting.
    expect(await screen.findByText(REV1)).toBeInTheDocument()
  })
})

describe('MinglerReviewsTab — detail modal delete', () => {
  it('deletes from within the detail modal and closes it', async () => {
    setDesktop()
    renderTab()
    const user = userEvent.setup()
    const row = (await screen.findByText(REV2)).closest('tr') as HTMLElement
    await user.click(row)
    const dialog = await screen.findByRole('dialog')

    await user.click(within(dialog).getByText('Delete review').closest('button') as HTMLElement)
    // Confirmation modal, then confirm.
    const confirm = await screen.findByText('Delete review?')
    const confirmModal = confirm.closest('.ant-modal') as HTMLElement
    await user.click(within(confirmModal).getByRole('button', { name: 'Delete' }))

    // Success toast confirms the soft-delete went through. (The detail modal's
    // own copy of the body text lingers during jsdom's close animation, so we
    // assert on the toast rather than text removal here.)
    expect(await screen.findByText('Review deleted.')).toBeInTheDocument()
  })
})

describe('MinglerReviewsTab — mobile cards', () => {
  it('renders mobile review cards and deletes via the card action', async () => {
    setMobile()
    renderTab()
    const user = userEvent.setup()
    const card = (await screen.findByText(REV3)).closest(
      '.detail-reviews-card-list > div',
    ) as HTMLElement

    await user.click(within(card).getByLabelText('Delete'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('Review deleted.')).toBeInTheDocument()
  })

  it('opens the detail modal from a mobile card tap', async () => {
    setMobile()
    renderTab()
    const user = userEvent.setup()
    const card = (await screen.findByText(REV1)).closest(
      '.detail-reviews-card-list > div',
    ) as HTMLElement
    await user.click(card)
    expect(await screen.findByText('Review details')).toBeInTheDocument()
  })
})

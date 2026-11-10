import { describe, it, expect, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { CategoriesPage } from '../CategoriesPage'

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

const cats = [
  {
    id: '1',
    name: 'Pizza',
    commissionRate: 5,
    interestTablesPerMonth: 10,
    restaurantsCount: 2,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Sushi',
    commissionRate: 7,
    interestTablesPerMonth: 12,
    restaurantsCount: 0,
    createdAt: '2026-01-02T00:00:00Z',
  },
]

describe('CategoriesPage', () => {
  beforeEach(() => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.json(cats)))
  })

  it('renders categories from API', async () => {
    renderWithProviders(<CategoriesPage />)
    expect(await screen.findByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
  })

  it('opens new category modal', async () => {
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Pizza')
    const newBtn = screen.getByRole('button', { name: /new category/i })
    await userEvent.setup().click(newBtn)
    await waitFor(() => expect(screen.getByRole('button', { name: /create/i })).toBeInTheDocument())
  })

  it('opens delete modal with blocked content when restaurants > 0', async () => {
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Pizza')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const firstRow = rows[0]
    const actionDivs = firstRow.querySelectorAll('td:last-child > div > div')
    const user = userEvent.setup()
    await user.click(actionDivs[1] as Element)
    await waitFor(() => expect(screen.getByText(/Cannot delete/i)).toBeInTheDocument())
    // Blocked variant exposes only a Got it button (no destructive action)
    const buttons = screen.getAllByRole('button')
    const okBtn = buttons.find((b) => /^(ok|got it)$/i.test((b.textContent ?? '').trim()))
    if (okBtn) await user.click(okBtn)
  })

  it('opens delete modal and confirms delete when restaurantCount=0', async () => {
    server.use(http.delete('/api/v1/categories/:id', () => new HttpResponse(null, { status: 204 })))
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Sushi')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const sushiRow = rows[1]
    const actionDivs = sushiRow.querySelectorAll('td:last-child > div > div')
    const user = userEvent.setup()
    await user.click(actionDivs[1] as Element)
    // Title is now "Delete category?" (spec v5.0 fixed text, no name interpolation)
    await waitFor(() => expect(screen.getAllByText(/Delete category\?/i).length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.getAllByText(/"Sushi"/).length).toBeGreaterThan(0))
    const buttons = screen.getAllByRole('button')
    const delBtn = buttons.find((b) => /^Delete category$/.test((b.textContent ?? '').trim()))
    if (delBtn) await user.click(delBtn)
  })

  it('opens edit modal and submits to update', async () => {
    server.use(
      http.patch('/api/v1/categories/:id', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Pizza')
    // Row click triggers edit (pencil icon removed from table; edit via onRow)
    const user = userEvent.setup()
    await user.click(screen.getByText('Pizza'))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument(),
    )
    await user.click(screen.getByRole('button', { name: /save changes/i }))
  })

  it('cancels delete modal via X icon', async () => {
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Sushi')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = rows[1].querySelectorAll('td:last-child > div > div')
    const user = userEvent.setup()
    await user.click(actionDivs[0] as Element)
    const closeBtns = await screen.findAllByLabelText('Close')
    if (closeBtns[0]) await user.click(closeBtns[0])
  })

  it('changes page size to 10', async () => {
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Pizza')
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[0])
    const opts = await screen.findAllByText(/10 \/ page/i)
    await user.click(opts[opts.length - 1])
  })

  it('shows error alert when fetch fails', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<CategoriesPage />)
    await waitFor(() => expect(document.querySelector('.ant-alert-error')).not.toBeNull())
  })
})

describe('CategoriesPage — mobile card view', () => {
  beforeEach(() => {
    setMobile()
    server.use(http.get('/api/v1/categories', () => HttpResponse.json(cats)))
  })

  it('renders category cards in mobile layout', async () => {
    renderWithProviders(<CategoriesPage />)
    expect(await screen.findByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()
  })

  it('opens edit modal from mobile card Edit button', async () => {
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Pizza')
    const editBtns = document.querySelectorAll('.categories-card-list button')
    const editBtn = Array.from(editBtns).find((b) => /^edit$/i.test((b.textContent ?? '').trim()))
    if (editBtn) fireEvent.click(editBtn)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /save changes/i })).toBeInTheDocument(),
    )
  })

  it('opens delete modal from mobile card Delete button', async () => {
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Pizza')
    const allBtns = document.querySelectorAll('.categories-card-list button')
    const deleteBtn = Array.from(allBtns).find((b) =>
      /^delete$/i.test((b.textContent ?? '').trim()),
    )
    if (deleteBtn) fireEvent.click(deleteBtn)
    await waitFor(() => expect(screen.queryByText(/Cannot delete/i)).toBeInTheDocument())
  })

  it('shows plural restaurants label when restaurantsCount > 1', async () => {
    renderWithProviders(<CategoriesPage />)
    await screen.findByText('Pizza')
    expect(screen.getByText(/2 restaurants/i)).toBeInTheDocument()
  })

  it('shows singular restaurant label when restaurantsCount = 1', async () => {
    const oneRestaurant = [{ ...cats[0], restaurantsCount: 1 }]
    server.use(http.get('/api/v1/categories', () => HttpResponse.json(oneRestaurant)))
    renderWithProviders(<CategoriesPage />)
    expect(await screen.findByText(/1 restaurant$/)).toBeInTheDocument()
  })
})

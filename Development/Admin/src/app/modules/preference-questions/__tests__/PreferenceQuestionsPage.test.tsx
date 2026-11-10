import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { PreferenceQuestionsPage } from '../PreferenceQuestionsPage'

const BASE = '/api/v1/preference-questions'

// Builds a server-side paginated list handler over `total` synthetic questions.
// It honours the page / pageSize query params exactly like the real backend and
// exposes the last requested URL so tests can assert what was sent to the server.
function paginatedHandler(total: number) {
  const all = Array.from({ length: total }, (_, i) => ({
    id: `pq${i + 1}`,
    question: `Question ${i + 1}`,
    type: 'SINGLE_SELECT' as const,
    questionOrder: i + 1,
    optionsCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
  }))
  let capturedUrl = ''
  const handler = http.get(BASE, ({ request }) => {
    capturedUrl = request.url
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
    const pageSize = Number(url.searchParams.get('pageSize') ?? '10')
    const start = (page - 1) * pageSize
    const items = all.slice(start, start + pageSize)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return HttpResponse.json({
      success: true,
      data: { items, pagination: { page, pageSize, totalRecords: total, totalPages } },
    })
  })
  return { handler, getUrl: () => capturedUrl }
}

describe('PreferenceQuestionsPage', () => {
  it('renders the question list', async () => {
    renderWithProviders(<PreferenceQuestionsPage />)
    expect(await screen.findByText('How often do you eat out?')).toBeInTheDocument()
  })

  it('creates a new question successfully', async () => {
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('How often do you eat out?')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new question/i }))

    await user.type(
      await screen.findByPlaceholderText('e.g. How often do you eat out?'),
      'Do you like spicy food?',
    )
    const optionInputs = screen.getAllByPlaceholderText('Option text')
    fireEvent.change(optionInputs[0], { target: { value: 'Yes' } })
    await user.click(screen.getByRole('button', { name: /add option/i }))
    const optionInputsAfterAdd = screen.getAllByPlaceholderText('Option text')
    fireEvent.change(optionInputsAfterAdd[1], { target: { value: 'No' } })

    await user.click(screen.getByRole('button', { name: /create question/i }))

    expect(
      await screen.findByText(/"Do you like spicy food\?" has been created\./),
    ).toBeInTheDocument()
  })

  it('keeps the new question modal open and shows a generic error when create fails with an unmatched error', async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
    )
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('How often do you eat out?')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new question/i }))

    await user.type(
      await screen.findByPlaceholderText('e.g. How often do you eat out?'),
      'Do you like spicy food?',
    )
    const optionInputs = screen.getAllByPlaceholderText('Option text')
    fireEvent.change(optionInputs[0], { target: { value: 'Yes' } })
    await user.click(screen.getByRole('button', { name: /add option/i }))
    const optionInputsAfterAdd = screen.getAllByPlaceholderText('Option text')
    fireEvent.change(optionInputsAfterAdd[1], { target: { value: 'No' } })

    await user.click(screen.getByRole('button', { name: /create question/i }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    // Modal stays open with the typed data intact.
    expect(screen.getByRole('button', { name: /create question/i })).toBeInTheDocument()
    expect(screen.getByDisplayValue('Do you like spicy food?')).toBeInTheDocument()
  })

  it('keeps the edit modal open and shows a generic error when the update fails with an unmatched error', async () => {
    server.use(
      http.patch(`${BASE}/:id`, () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
    )
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('How often do you eat out?')
    const user = userEvent.setup()

    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    fireEvent.click(rows[0])

    const saveBtn = await screen.findByRole('button', { name: /save changes/i }, { timeout: 5000 })
    await user.click(saveBtn)

    await waitFor(() =>
      expect(screen.getAllByText(/something went wrong/i).length).toBeGreaterThan(0),
    )
    // The edit modal must still be open.
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })
})

describe('PreferenceQuestionsPage — server-side pagination', () => {
  it('requests the default page size of 10', async () => {
    const { handler, getUrl } = paginatedHandler(25)
    server.use(handler)
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('Question 1')
    expect(getUrl()).toContain('pageSize=10')
    expect(screen.getByText(/Showing 1–10 of 25/)).toBeInTheDocument()
  })

  it('changes the page size and issues a server-side request for the new size', async () => {
    const { handler, getUrl } = paginatedHandler(60)
    server.use(handler)
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('Question 1')

    const user = userEvent.setup()
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    const opts = await screen.findAllByText(/25\/page/i)
    await user.click(opts[opts.length - 1])

    // The query is driven by the local selection, so a request for pageSize=25
    // proves the size change took effect (and did not snap back to a server echo).
    await waitFor(() => expect(getUrl()).toContain('pageSize=25'))
    expect(getUrl()).toContain('page=1')
  })

  it('moves to the next page and requests page 2', async () => {
    const { handler, getUrl } = paginatedHandler(25)
    server.use(handler)
    renderWithProviders(<PreferenceQuestionsPage />)
    await screen.findByText('Question 1')

    await userEvent.setup().click(screen.getByTitle('Next Page'))

    await waitFor(() => expect(getUrl()).toContain('page=2'))
    expect(await screen.findByText('Question 11')).toBeInTheDocument()
  })

  it('shows a zeroed summary when there are no questions', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        }),
      ),
    )
    renderWithProviders(<PreferenceQuestionsPage />)
    expect(await screen.findByText(/Showing 0–0 of 0/)).toBeInTheDocument()
  })
})

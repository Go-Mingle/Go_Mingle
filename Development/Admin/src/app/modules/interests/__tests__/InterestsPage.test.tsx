import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestsPage } from '../InterestsPage'

// Force the mobile card layout, whose Edit/Delete actions are labelled <button>s
// (the desktop table renders unlabelled icon divs).
function setMobile() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: false,
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

beforeEach(() => setMobile())

describe('InterestsPage — pagination', () => {
  const LIST = '/api/v1/interests'

  /** Captures every list request and answers with a 60-record result set. */
  function installListSpy() {
    const requests: string[] = []
    server.use(
      http.get(LIST, ({ request }) => {
        requests.push(request.url)
        const url = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [{ id: 'i1', name: 'Wine', groupName: 'Food & Drink' }],
            pagination: {
              page: Number(url.searchParams.get('page') ?? 1),
              pageSize: Number(url.searchParams.get('pageSize') ?? 25),
              totalRecords: 60,
              totalPages: 3,
            },
          },
        })
      }),
    )
    return requests
  }

  it('calls the API with the selected page size', async () => {
    const requests = installListSpy()
    renderWithProviders(<InterestsPage />)
    const user = userEvent.setup()
    await waitFor(() => expect(requests.some((u) => u.includes('pageSize=25'))).toBe(true))

    const pager = document.querySelector('.interests-pagination') as HTMLElement
    await user.click(within(pager).getByRole('combobox'))
    await user.click(await screen.findByText('50 / page'))

    await waitFor(() => expect(requests.some((u) => u.includes('pageSize=50'))).toBe(true))
  })

  it('calls the API with the requested page', async () => {
    const requests = installListSpy()
    renderWithProviders(<InterestsPage />)
    await waitFor(() => expect(requests.length).toBeGreaterThan(0))

    fireEvent.click(document.querySelector('.ant-pagination-next') as HTMLElement)
    await waitFor(() => expect(requests.some((u) => u.includes('page=2'))).toBe(true))
  })
})

describe('InterestsPage — delete', () => {
  it('shows the API error message in a toast when deleting an in-use interest fails', async () => {
    const apiMessage =
      'Cannot delete interest. It is currently used by one or more topics. Remove it from those topics before deleting.'
    server.use(
      http.delete('/api/v1/interests/:id', () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_INTEREST_IN_USE', message: apiMessage, details: {} },
          },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<InterestsPage />)
    const user = userEvent.setup()

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])
    await user.click(await screen.findByRole('button', { name: 'Delete interest' }))

    expect(await screen.findByText(apiMessage)).toBeInTheDocument()
  })

  it('shows a success toast when the delete succeeds', async () => {
    server.use(
      // Non-mutating 204 so the shared fixture list isn't drained across tests.
      http.delete('/api/v1/interests/:id', () => new HttpResponse(null, { status: 204 })),
    )
    renderWithProviders(<InterestsPage />)
    const user = userEvent.setup()

    const deleteButtons = await screen.findAllByRole('button', { name: 'Delete' })
    await user.click(deleteButtons[0])
    await user.click(await screen.findByRole('button', { name: 'Delete interest' }))

    expect(await screen.findByText(/interest deleted/i)).toBeInTheDocument()
  })
})

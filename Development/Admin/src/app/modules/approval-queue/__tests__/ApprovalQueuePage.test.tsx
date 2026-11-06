import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal } from 'antd'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ApprovalQueuePage } from '../ApprovalQueuePage'

const LIST = '/api/v1/admin/approvals'

function setViewport(kind: 'min-width' | 'max-width') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: new RegExp(kind).test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}
const setDesktop = () => setViewport('min-width')
const setMobile = () => setViewport('max-width')

const pending = [
  {
    id: 'a1',
    name: 'Alpha',
    cuisine: 'Italian',
    ownerName: 'Owner1',
    ownerPhone: '555',
    ownerEmail: 'a@x.c',
    city: 'NYC',
    submittedAt: '15-01-2024',
  },
]
const rejected = [
  {
    id: 'a2',
    name: 'Beta',
    cuisine: 'French',
    ownerName: 'Owner2',
    city: 'LA',
    submittedAt: '10-01-2024',
    rejectedAt: '01-02-2024',
    latestReason: 'because',
  },
]

let requests: string[] = []

function installHandlers(totalRecords = pending.length) {
  requests = []
  server.use(
    http.get(LIST, ({ request }) => {
      const url = new URL(request.url)
      requests.push(url.search)
      const status = url.searchParams.get('status')
      const items = status === 'rejected' ? rejected : pending
      return HttpResponse.json({
        success: true,
        data: {
          items,
          pagination: {
            page: Number(url.searchParams.get('page') ?? 1),
            pageSize: Number(url.searchParams.get('pageSize') ?? 25),
            totalRecords,
            totalPages: Math.ceil(totalRecords / 25),
          },
        },
      })
    }),
    http.get('/api/v1/categories/active', () =>
      HttpResponse.json({ success: true, data: [{ id: 'c1', name: 'Premium' }] }),
    ),
  )
}

beforeEach(() => {
  setDesktop()
  installHandlers()
})

afterEach(() => {
  Modal.destroyAll()
})

describe('ApprovalQueuePage (desktop)', () => {
  it('loads pending on mount with the default query params', async () => {
    renderWithProviders(<ApprovalQueuePage />)
    expect(await screen.findByText('Alpha')).toBeInTheDocument()
    expect(requests[0]).toContain('status=pending')
    expect(requests[0]).toContain('page=1')
    expect(requests[0]).toContain('pageSize=10')
    expect(requests[0]).toContain('sortBy=submittedAt')
    expect(requests[0]).toContain('sortOrder=asc')
  })

  it('requests rejected with descending default and no sortBy when switching tab', async () => {
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    await userEvent.setup().click(screen.getByRole('tab', { name: /rejected/i }))
    expect(await screen.findByText('Beta')).toBeInTheDocument()
    const rejectedReq = requests.find((r) => r.includes('status=rejected'))!
    expect(rejectedReq).toContain('sortOrder=desc')
    expect(rejectedReq).not.toContain('sortBy')
  })

  it('approves a pending application via the approve modal', async () => {
    let body: unknown
    server.use(
      http.post(`${LIST}/:id/approve`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          success: true,
          data: { id: 'a1', status: 'ACTIVE', category: { id: 'c1', name: 'Premium' } },
        })
      }),
    )
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const row = document.querySelector('.approval-queue-table tbody tr.ant-table-row')!
    const svgs = row.querySelectorAll('td:last-child svg')
    fireEvent.click(svgs[0].closest('div') as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByText('Premium'))
    await user.click(within(dialog).getByRole('button', { name: /approve application/i }))
    await waitFor(() => expect(body).toEqual({ categoryId: 'c1' }))
  })

  it('shows a conflict warning when the application was already actioned', async () => {
    server.use(
      http.post(`${LIST}/:id/approve`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_APPLICATION_ALREADY_ACTIONED', message: 'x', details: {} },
          },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const row = document.querySelector('.approval-queue-table tbody tr.ant-table-row')!
    fireEvent.click(row.querySelectorAll('td:last-child svg')[0].closest('div') as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByText('Premium'))
    await user.click(within(dialog).getByRole('button', { name: /approve application/i }))
    expect(await screen.findByText(/already actioned/i)).toBeInTheDocument()
  })

  it('declines a pending application via the decline modal', async () => {
    let body: { reason?: string } | undefined
    server.use(
      http.post(`${LIST}/:id/decline`, async ({ request }) => {
        body = (await request.json()) as { reason?: string }
        return HttpResponse.json({
          success: true,
          data: { id: 'a1', status: 'REJECTED', rejectedAt: '20-02-2024' },
        })
      }),
    )
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const row = document.querySelector('.approval-queue-table tbody tr.ant-table-row')!
    fireEvent.click(row.querySelectorAll('td:last-child svg')[1].closest('div') as HTMLElement)
    const textarea = await screen.findByPlaceholderText(/explain why/i)
    await user.type(textarea, 'A perfectly valid rejection reason.')
    await user.click(screen.getByRole('button', { name: /decline application/i }))
    await waitFor(() => expect(body?.reason).toContain('valid rejection'))
  })

  it('renders an error alert when the listing request fails', async () => {
    server.use(http.get(LIST, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<ApprovalQueuePage />)
    await waitFor(() => expect(document.querySelector('.ant-alert-error')).toBeInTheDocument())
  })

  it('requests the next page from pagination', async () => {
    installHandlers(60)
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const next = document.querySelector('.ant-pagination-next') as HTMLElement
    fireEvent.click(next)
    await waitFor(() => expect(requests.some((r) => r.includes('page=2'))).toBe(true))
  })

  it('sorts and changes page size on the pending tab', async () => {
    installHandlers(60)
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    fireEvent.click(
      document.querySelector('.approval-queue-table th.ant-table-column-has-sorters')!,
    )
    await waitFor(() => expect(requests.some((r) => r.includes('sortBy=restaurant'))).toBe(true))
    await user.click(screen.getByRole('combobox'))
    await user.click(await screen.findByText('50 / page'))
    await waitFor(() => expect(requests.some((r) => r.includes('pageSize=50'))).toBe(true))
  })

  it('sorts, re-pages and changes size on the rejected tab', async () => {
    installHandlers(60)
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /rejected/i }))
    await screen.findByText('Beta')
    fireEvent.click(
      document.querySelector('.approval-queue-table th.ant-table-column-has-sorters')!,
    )
    await waitFor(() =>
      expect(
        requests.some((r) => r.includes('status=rejected') && r.includes('sortBy=restaurant')),
      ).toBe(true),
    )
    fireEvent.click(document.querySelector('.ant-pagination-next') as HTMLElement)
    await waitFor(() =>
      expect(requests.some((r) => r.includes('status=rejected') && r.includes('page=2'))).toBe(
        true,
      ),
    )
    await user.click(screen.getByRole('combobox'))
    // Default page size is 10, so pick a non-default size to exercise a real change.
    await user.click(await screen.findByText('25 / page'))
    await waitFor(() =>
      expect(requests.some((r) => r.includes('status=rejected') && r.includes('pageSize=25'))).toBe(
        true,
      ),
    )
  })
})

describe('ApprovalQueuePage (mobile)', () => {
  beforeEach(() => {
    setMobile()
    installHandlers()
  })

  it('renders the pending card list and opens the approve modal', async () => {
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    const approveBtn = screen.getByRole('button', { name: /^approve$/i })
    await user.click(approveBtn)
    expect(await screen.findByRole('button', { name: /approve application/i })).toBeInTheDocument()
  })

  it('opens the decline modal and navigates via View from the pending card', async () => {
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^decline$/i }))
    expect(await screen.findByRole('button', { name: /decline application/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel/i }))
    await user.click(screen.getByRole('button', { name: /view/i }))
  })

  it('renders the rejected card list and navigates via View', async () => {
    renderWithProviders(<ApprovalQueuePage />)
    await screen.findByText('Alpha')
    const user = userEvent.setup()
    await user.click(screen.getByRole('tab', { name: /rejected/i }))
    await screen.findByText('Beta')
    await user.click(screen.getByRole('button', { name: /view/i }))
  })
})

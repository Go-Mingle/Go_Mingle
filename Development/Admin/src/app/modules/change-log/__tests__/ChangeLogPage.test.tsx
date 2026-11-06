import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { ChangeLogPage } from '../ChangeLogPage'

const sampleLogs = [
  {
    id: '1',
    timestamp: '2025-01-01 10:00',
    admin: 'jane',
    initials: 'JD',
    action: 'create',
    oldVal: '—',
    newVal: 'Yes',
    data: 'User created',
    module: 'Users',
  },
  {
    id: '2',
    timestamp: '2025-01-02 10:00',
    admin: 'john',
    initials: 'JS',
    action: 'update',
    oldVal: 'A',
    newVal: 'B',
    data: 'Category updated',
    module: 'Categories',
  },
]

beforeEach(() => {
  server.use(http.get('/api/v1/change-log', () => HttpResponse.json(sampleLogs)))
  // reset matchMedia default to desktop (1280px)
  ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => {
    const minMatch = /\(min-width:\s*(\d+)px\)/.exec(q)
    const maxMatch = /\(max-width:\s*(\d+)px\)/.exec(q)
    const width = 1280
    const matches = minMatch
      ? width >= Number(minMatch[1])
      : maxMatch
        ? width <= Number(maxMatch[1])
        : false
    return {
      matches,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }
  })
})

describe('ChangeLogPage (desktop)', () => {
  it('renders title and table after data loads', async () => {
    renderWithProviders(<ChangeLogPage />)
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('jane')).toBeInTheDocument())
  })

  it('triggers CSV export on button click', async () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:url')
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    renderWithProviders(<ChangeLogPage />)
    await waitFor(() => expect(screen.getByText('jane')).toBeInTheDocument())
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /export/i }))
    expect(createObjectURL).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
  })

  // A-11 — the audit read API is not deployed everywhere. A 404 means the service
  // is absent, which must read differently from a transient fetch failure.
  it('shows the audit-unavailable warning when the API returns 404', async () => {
    server.use(http.get('/api/v1/change-log', () => HttpResponse.json({}, { status: 404 })))
    renderWithProviders(<ChangeLogPage />)
    await waitFor(() =>
      expect(screen.getByText(/audit trail service is unavailable/i)).toBeInTheDocument(),
    )
    expect(screen.queryByText(/failed to load data/i)).not.toBeInTheDocument()
  })

  it('shows the generic fetch error for a non-404 failure', async () => {
    server.use(http.get('/api/v1/change-log', () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<ChangeLogPage />)
    await waitFor(() => expect(screen.getByText(/failed to load data/i)).toBeInTheDocument())
    expect(screen.queryByText(/audit trail service is unavailable/i)).not.toBeInTheDocument()
  })

  it('disables CSV export when there are no rows to export', async () => {
    server.use(http.get('/api/v1/change-log', () => HttpResponse.json([])))
    renderWithProviders(<ChangeLogPage />)
    await waitFor(() => expect(screen.getByRole('button', { name: /export/i })).toBeDisabled())
  })

  it('changes page size via pagination select', async () => {
    renderWithProviders(<ChangeLogPage />)
    await waitFor(() => expect(screen.getByText('jane')).toBeInTheDocument())
    const user = userEvent.setup()
    const combos = screen.getAllByRole('combobox')
    // pageSize select is now the only combobox (module dropdown removed)
    await user.click(combos[0])
    const opt = await screen.findByText('10 / page', {
      selector: '.ant-select-item-option-content',
    })
    await user.click(opt)
  })
})

describe('ChangeLogPage (mobile)', () => {
  beforeEach(() => {
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => {
      const minMatch = /\(min-width:\s*(\d+)px\)/.exec(q)
      const maxMatch = /\(max-width:\s*(\d+)px\)/.exec(q)
      const width = 500
      const matches = minMatch
        ? width >= Number(minMatch[1])
        : maxMatch
          ? width <= Number(maxMatch[1])
          : false
      return {
        matches,
        media: q,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }
    })
    // also force innerWidth to mobile so initial state is true
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
  })

  it('renders card list on mobile', async () => {
    renderWithProviders(<ChangeLogPage />)
    await waitFor(() => expect(screen.getByText('jane')).toBeInTheDocument())
    // Card list uses the same field labels as the desktop table (Target)
    expect(screen.getAllByText(/Target/i).length).toBeGreaterThan(0)
  })

  it('renders card with empty oldVal/newVal and unknown action', async () => {
    server.use(
      http.get('/api/v1/change-log', () =>
        HttpResponse.json([
          {
            id: 'x',
            timestamp: '',
            admin: '@dual name',
            action: 'weird',
            module: 'Mystery',
            data: 'thing',
            oldVal: undefined,
            newVal: undefined,
          },
          {
            id: 'y',
            timestamp: '2025-02-01T10:00:00Z',
            admin: 'singleword',
            action: 'create',
            module: 'Users',
            data: 'rec',
            oldVal: 'a',
            newVal: 'b',
          },
          {
            id: 'z',
            timestamp: '',
            admin: '  ',
            action: 'delete',
            module: 'Users',
            data: undefined,
            oldVal: 'x',
            newVal: 'y',
          },
        ]),
      ),
    )
    renderWithProviders(<ChangeLogPage />)
    await waitFor(() => expect(screen.getByText('singleword')).toBeInTheDocument())
  })
})

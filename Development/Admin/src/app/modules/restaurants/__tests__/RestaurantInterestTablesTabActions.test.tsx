import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { server } from '../../../../mocks/server'
import { RestaurantInterestTablesTab } from '../RestaurantInterestTablesTab'
import type { InterestTable } from '../../interest-tables/types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

const RID = 'rest-actions-1'
const LIST = `/api/v1/restaurants/${RID}/interest-tables`

function tableRow(over: Partial<InterestTable> = {}): InterestTable {
  return {
    id: 'it-a1',
    name: 'Coming Soon Table',
    topic: { id: 't1', name: 'Wine', graphicUrl: null },
    assignedTable: { id: 'tbl1', name: 'Window' },
    restaurant: { id: RID, name: 'Aurelia' },
    seatsBooked: 0,
    minMinglers: 4,
    maxMinglers: 6,
    startDate: '2026-08-01',
    startTime: '19:00',
    durationHours: 2,
    sponsorName: null,
    sponsorLogoUrl: null,
    eventImageUrl: null,
    timeLeft: '2d',
    status: 'COMING_SOON',
    created: '2026-07-01T00:00:00Z',
    ...over,
  }
}

function seedList(items: InterestTable[]) {
  server.use(
    http.get(LIST, () =>
      HttpResponse.json({
        success: true,
        data: {
          items,
          pagination: { page: 1, pageSize: 10, totalRecords: items.length, totalPages: 1 },
        },
      }),
    ),
  )
}

function firstActionIcon(rowText: string): SVGElement {
  const row = screen.getByText(rowText).closest('tr') as HTMLElement
  const cell = row.querySelector('td:last-child') as HTMLElement
  return cell.querySelectorAll('svg')[0] as SVGElement
}

beforeEach(() => vi.clearAllMocks())

describe('RestaurantInterestTablesTab actions', () => {
  it('makes a COMING_SOON table available and shows a success toast', async () => {
    seedList([tableRow()])
    server.use(
      http.post('/api/v1/interest-tables/it-a1/make-available', () =>
        HttpResponse.json({
          success: true,
          data: { id: 'it-a1', status: 'PENDING', availability: 'AVAILABLE_NOW' },
        }),
      ),
    )
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{ id: RID, name: 'Aurelia' }} />)
    await screen.findByText('Coming Soon Table')
    fireEvent.click(firstActionIcon('Coming Soon Table'))
    expect(await screen.findByText('Interest table is now available.')).toBeInTheDocument()
  })

  it('surfaces an error toast when make-available fails', async () => {
    seedList([tableRow()])
    server.use(
      http.post('/api/v1/interest-tables/it-a1/make-available', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR', message: 'nope' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{ id: RID, name: 'Aurelia' }} />)
    await screen.findByText('Coming Soon Table')
    fireEvent.click(firstActionIcon('Coming Soon Table'))
    // getApiErrorMessage falls back to the generic error toast.
    await waitFor(() => expect(document.querySelector('.ant-message-error')).not.toBeNull())
  })

  it('navigates into the detail page edit mode from the DRAFT pencil action', async () => {
    seedList([tableRow({ id: 'it-draft', name: 'Draft Table', status: 'DRAFT' })])
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{ id: RID, name: 'Aurelia' }} />)
    await screen.findByText('Draft Table')
    fireEvent.click(firstActionIcon('Draft Table'))
    expect(mockNavigate).toHaveBeenCalledWith(
      `/restaurants/${RID}/interest-tables/it-draft?tab=overview&edit=1`,
    )
  })

  it('navigates to the mingler detail page when the promingler name is clicked', async () => {
    seedList([
      tableRow({
        name: 'Promingler Table',
        prominglerEnabled: true,
        promingler: { id: 'm1', fullName: 'Laiba Hassan' },
      }),
    ])
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{ id: RID, name: 'Aurelia' }} />)
    await screen.findByText('Promingler Table')
    fireEvent.click(screen.getByText('Laiba Hassan'))
    expect(mockNavigate).toHaveBeenCalledWith('/minglers/m1')
  })

  it('opens the create modal from the New interest table button', async () => {
    seedList([tableRow()])
    const user = userEvent.setup()
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{ id: RID, name: 'Aurelia' }} />)
    await screen.findByText('Coming Soon Table')
    await user.click(screen.getByRole('button', { name: /new interest table/i }))
    expect(
      await screen.findByText('New interest table', { selector: '.ant-modal-title' }),
    ).toBeInTheDocument()
  })

  it('disables the New interest table button when the restaurant is suspended', async () => {
    seedList([tableRow()])
    renderWithProviders(
      <RestaurantInterestTablesTab
        restaurant={{ id: RID, name: 'Aurelia', status: 'SUSPENDED' }}
      />,
    )
    await screen.findByText('Coming Soon Table')
    expect(screen.getByRole('button', { name: /new interest table/i })).toBeDisabled()
  })

  it('sends the Name search as the server `q` query param', async () => {
    let lastUrl: URL | undefined
    server.use(
      http.get(LIST, ({ request }) => {
        lastUrl = new URL(request.url)
        return HttpResponse.json({
          success: true,
          data: {
            items: [tableRow()],
            pagination: { page: 1, pageSize: 10, totalRecords: 1, totalPages: 1 },
          },
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{ id: RID, name: 'Aurelia' }} />)
    await screen.findByText('Coming Soon Table')

    const triggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(triggers[0] as HTMLElement) // Name column search
    const input = await screen.findByPlaceholderText('Search tables…')
    await user.type(input, 'wine{enter}')

    await waitFor(() => expect(lastUrl?.searchParams.get('q')).toBe('wine'))
    expect(lastUrl?.searchParams.get('page')).toBe('1')
  })

  it('narrows the current page client-side by Mode with no server mode param', async () => {
    const items = [
      tableRow({ id: 'now', name: 'Now Table', availabilityMode: 'AVAILABLE_NOW' }),
      tableRow({ id: 'soon', name: 'Soon Table', availabilityMode: 'COMING_SOON' }),
    ]
    const searches: string[] = []
    server.use(
      http.get(LIST, ({ request }) => {
        searches.push(new URL(request.url).search)
        return HttpResponse.json({
          success: true,
          data: {
            items,
            pagination: { page: 1, pageSize: 10, totalRecords: items.length, totalPages: 1 },
          },
        })
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(<RestaurantInterestTablesTab restaurant={{ id: RID, name: 'Aurelia' }} />)
    await screen.findByText('Now Table')
    expect(screen.getByText('Soon Table')).toBeInTheDocument()

    // Apply Mode = Coming soon (availability is the 2nd filter trigger).
    const triggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(triggers[1] as HTMLElement)
    const options = document.querySelectorAll('.ant-table-filter-dropdown .ant-dropdown-menu-item')
    const comingSoon = Array.from(options).find((o) => /coming soon/i.test(o.textContent ?? ''))
    await user.click(comingSoon as HTMLElement)
    const okBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown-btns button'),
    ).find((b) => /ok/i.test(b.textContent ?? ''))
    if (okBtn) await user.click(okBtn as HTMLElement)

    // Client-side narrowing: only the COMING_SOON row remains…
    await waitFor(() => expect(screen.queryByText('Now Table')).not.toBeInTheDocument())
    expect(screen.getByText('Soon Table')).toBeInTheDocument()
    // …and no request ever carried a mode/availability param.
    expect(searches.every((s) => !/mode|availability/i.test(s))).toBe(true)
  })
})

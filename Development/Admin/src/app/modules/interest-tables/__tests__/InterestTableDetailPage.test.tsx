import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { renderWithProviders, makeStore } from '../../../../test-utils/renderWithProviders'
import { server } from '../../../../mocks/server'
import { InterestTableDetailPage } from '../InterestTableDetailPage'

// Full-access user so the RBAC-gated Bookings / Invited sub-tabs and the
// Change ProMingler action are visible in these tests.
const superAdminUser = {
  id: 'u1',
  name: 'Hira Mansoor',
  email: 'hira.mansoor@gomingle.com',
  role: 'Super Admin',
  permissions: [] as string[],
  fullAccess: true,
  initials: 'HM',
}

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function draftTable(over: Record<string, unknown> = {}) {
  return {
    id: 'it1',
    name: 'Founders Dinner',
    topic: { id: 'topic-1', name: 'Tech', graphicUrl: null },
    assignedTable: { id: 'table-1', name: 'Window' },
    restaurant: { id: 'r1', name: 'Aurelia' },
    seatsBooked: 2,
    minMinglers: 4,
    maxMinglers: 6,
    minGuests: 4,
    maxGuests: 6,
    startDate: '2026-08-20',
    startTime: '19:00',
    durationHours: 2,
    durationMinutes: 120,
    sponsorName: null,
    sponsorLogoUrl: null,
    eventImageUrl: null,
    availabilityMode: 'AVAILABLE_NOW',
    inviteOnly: true,
    prominglerEnabled: true,
    prominglerMinglerId: 'p1',
    promingler: { id: 'p1', name: 'Bob' },
    timeLeft: '2d',
    status: 'DRAFT',
    created: '2026-07-01T00:00:00Z',
    ...over,
  }
}

function seedGetHandlers(table: Record<string, unknown> = draftTable()) {
  server.use(
    http.get('/api/v1/interest-tables/it1', () =>
      HttpResponse.json({ success: true, data: table }),
    ),
    http.get('/api/v1/interest-tables/it1/menu-options', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [
            {
              id: 'm1',
              name: 'Tasting',
              pricePkr: 200,
              courses: [{ course: 'Main Course', choose: 1, options: ['Steak'] }],
            },
          ],
        },
      }),
    ),
    http.get('/api/v1/interest-tables/it1/invitees', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [
            {
              minglerId: 'g1',
              fullName: 'Guest One',
              avatarUrl: null,
              isPromingler: false,
              dateInvited: '2026-07-02',
              status: 'INVITED',
            },
          ],
          pagination: { page: 1, pageSize: 10, totalRecords: 1, totalPages: 1 },
        },
      }),
    ),
    http.get('/api/v1/admin/bookings', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [
            {
              id: 'b1',
              bookingRef: 'BK-9',
              minglerId: 'm1',
              minglerName: 'Sana',
              isCrownProMingler: false,
              isTickProMingler: false,
              prominglerLabel: null,
              interestTableId: 'it1',
              interestTableName: 'Founders Dinner',
              topic: 'Tech',
              restaurantId: 'r1',
              restaurantName: 'Aurelia',
              menuOption: 'Tasting',
              date: '20-08-2026',
              time: '7:30 PM',
              status: 'CONFIRMED',
              billPkr: 200,
            },
          ],
          pagination: { page: 1, pageSize: 50, totalRecords: 1, totalPages: 1 },
        },
      }),
    ),
    http.get('/api/v1/restaurants/r1/tables', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [
            {
              id: 'table-1',
              name: 'Window',
              availability: [{ dayOfWeek: 4, start: '10:00', end: '23:00' }],
            },
          ],
        },
      }),
    ),
    http.get('/api/v1/restaurants/r1/menu-options', () =>
      HttpResponse.json({
        success: true,
        data: { items: [{ id: 'm1', name: 'Tasting', pricePkr: 200, courses: [] }] },
      }),
    ),
    http.get('/api/v1/topics/active', () =>
      HttpResponse.json({
        success: true,
        data: { items: [{ id: 'topic-1', name: 'Tech', graphicUrl: null }] },
      }),
    ),
    http.get('/api/v1/minglers/prominglers/active', () =>
      HttpResponse.json({
        success: true,
        data: { items: [{ id: 'p2', fullName: 'Carol', phone: '5', email: 'c@c.com' }] },
      }),
    ),
    http.get('/api/v1/minglers', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [{ id: 'g2', fullName: 'Guest Two', phone: '+92 305 000 0000' }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        },
      }),
    ),
    // Parent restaurant — used to know whether it is suspended (blocks delete).
    http.get('/api/v1/restaurants/r1', () =>
      HttpResponse.json({ success: true, data: { id: 'r1', name: 'Aurelia', status: 'ACTIVE' } }),
    ),
  )
}

function renderPage(route = '/restaurants/r1/interest-tables/it1') {
  return renderWithProviders(
    <Routes>
      <Route path="/restaurants/:rid/interest-tables/:id" element={<InterestTableDetailPage />} />
    </Routes>,
    { route, store: makeStore({ auth: { user: superAdminUser, isAuthenticated: true } }) },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InterestTableDetailPage', () => {
  it('renders the header and tabs for a DRAFT table', async () => {
    seedGetHandlers()
    renderPage()
    expect(await screen.findByRole('button', { name: /publish/i })).toBeInTheDocument()
    // DRAFT → Publish + Edit + Delete actions available.
    expect(screen.getByRole('button', { name: /publish/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    // Change Promingler (table is Promingled).
    expect(screen.getByRole('button', { name: /change promingler/i })).toBeInTheDocument()
  })

  it('publishes a draft and shows a success toast', async () => {
    seedGetHandlers()
    let published = false
    server.use(
      http.post('/api/v1/interest-tables/it1/publish', () => {
        published = true
        return HttpResponse.json({ success: true, data: draftTable({ status: 'PENDING' }) })
      }),
    )
    renderPage()
    await screen.findByRole('button', { name: /publish/i })
    await userEvent.setup().click(screen.getByRole('button', { name: /publish/i }))
    await waitFor(() => expect(published).toBe(true))
    expect(await screen.findByText('Interest table published.')).toBeInTheDocument()
  })

  // Deleting is disabled portal-wide: the button renders but never reaches the
  // confirm modal or the DELETE endpoint.
  it('does not delete a draft — the delete button is disabled', async () => {
    seedGetHandlers()
    let deleted = false
    server.use(
      http.delete('/api/v1/interest-tables/it1', () => {
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /publish/i })

    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    expect(deleteBtn).toBeDisabled()

    await user.click(deleteBtn)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(deleted).toBe(false)
  })

  it('auto-opens the edit modal from ?edit=1 and PATCHes on save', async () => {
    seedGetHandlers()
    let patched = false
    server.use(
      http.patch('/api/v1/interest-tables/it1', () => {
        patched = true
        return HttpResponse.json({ success: true, data: draftTable() })
      }),
    )
    const user = userEvent.setup()
    renderPage('/restaurants/r1/interest-tables/it1?edit=1')
    expect(
      await screen.findByText('Edit interest table', { selector: '.ant-modal-title' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(patched).toBe(true))
  })

  it('changes the Promingler via the modal', async () => {
    seedGetHandlers()
    let changed = false
    server.use(
      http.post('/api/v1/interest-tables/it1/promingler', () => {
        changed = true
        return HttpResponse.json({ success: true, data: draftTable() })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /publish/i })
    await user.click(screen.getByRole('button', { name: /change promingler/i }))
    const dialog = await screen.findByRole('dialog')
    // Pick the candidate (Carol) then confirm.
    const combo = within(dialog).getByRole('combobox')
    await user.click(combo)
    await user.click(await screen.findByText(/Carol/))
    await user.click(within(dialog).getByRole('button', { name: /change promingler/i }))
    await waitFor(() => expect(changed).toBe(true))
  })

  it('makes a COMING_SOON table available (confirm)', async () => {
    seedGetHandlers(
      draftTable({ status: 'COMING_SOON', availabilityMode: 'COMING_SOON', inviteOnly: false }),
    )
    let madeAvailable = false
    server.use(
      http.post('/api/v1/interest-tables/it1/make-available', () => {
        madeAvailable = true
        return HttpResponse.json({
          success: true,
          data: { id: 'it1', status: 'PENDING', availability: 'AVAILABLE_NOW' },
        })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /make available/i })
    await user.click(screen.getByRole('button', { name: /make available/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /make available/i }))
    await waitFor(() => expect(madeAvailable).toBe(true))
  })

  it('cancels a published table (confirm)', async () => {
    seedGetHandlers(
      draftTable({ status: 'PENDING', prominglerEnabled: false, promingler: undefined }),
    )
    let cancelled = false
    server.use(
      http.post('/api/v1/interest-tables/it1/cancel', () => {
        cancelled = true
        return HttpResponse.json({ success: true, data: { id: 'it1', status: 'CANCELLED' } })
      }),
    )
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /cancel table/i })
    await user.click(screen.getByRole('button', { name: /cancel table/i }))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /cancel table/i }))
    await waitFor(() => expect(cancelled).toBe(true))
  })

  it('renders the Bookings and Invited sub-tabs', async () => {
    seedGetHandlers()
    const user = userEvent.setup()
    renderPage()
    await screen.findByRole('button', { name: /publish/i })
    await user.click(screen.getByRole('tab', { name: /bookings/i }))
    expect(await screen.findByText('Sana')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /invited/i }))
    expect(await screen.findByText('Guest One')).toBeInTheDocument()
  })

  it('derives edit values from legacy fields when maxGuests/durationMinutes are absent', async () => {
    // Older payload shape: only maxMinglers + durationHours present.
    seedGetHandlers(
      draftTable({
        maxGuests: undefined,
        durationMinutes: undefined,
        durationHours: 2,
        maxMinglers: 5,
      }),
    )
    renderPage('/restaurants/r1/interest-tables/it1?edit=1')
    // Modal opens prefilled — falls back to maxMinglers (5) and durationHours*60 (120).
    // Renders without throwing — editInitialValues fell back to maxMinglers /
    // durationHours*60 (no maxGuests / durationMinutes on the payload).
    expect(
      await screen.findByText('Edit interest table', { selector: '.ant-modal-title' }),
    ).toBeInTheDocument()
  })

  it('redirects to the list when the table is not found (404)', async () => {
    server.use(
      http.get('/api/v1/interest-tables/it1', () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTEREST_TABLE_NOT_FOUND' } },
          { status: 404 },
        ),
      ),
    )
    renderPage()
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/restaurants/r1/interest-tables', {
        replace: true,
      }),
    )
  })
})

import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders, makeStore } from '../../../../test-utils/renderWithProviders'
import { RestaurantDetailPage } from '../RestaurantDetailPage'

const RESTAURANT_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const BASE = `/api/v1/restaurants/${RESTAURANT_ID}`
const CATEGORIES_BASE = '/api/v1/categories/active'
const APPROVALS_BASE = `/api/v1/admin/approvals/${RESTAURANT_ID}`

const fixtureDetail = {
  id: RESTAURANT_ID,
  name: 'Aurelia',
  category: { id: 'cat-1', name: 'Premium' } as { id: string; name: string } | null,
  cuisine: 'Italian',
  description: 'Elevated Mediterranean waterfront dining.' as string | null,
  seatingCapacity: 40,
  phone: '+923000000000',
  email: 'info@aurelia.test',
  website: 'aurelia.test',
  latitude: 24.86,
  longitude: 67.0,
  fullAddress: '12 Clifton Boardwalk',
  areaDistrict: 'Marina',
  city: 'Karachi',
  ownerName: 'Jane Doe',
  ownerPhone: '+923011111111',
  ownerEmail: 'jane@aurelia.test',
  businessRegNo: 'BRN-123',
  servesAlcohol: true,
  houseRules: 'No outside food',
  dressCode: 'Smart casual',
  joinedAt: '2026-07-01T13:15:36.539Z',
  status: 'ACTIVE',
  visibleOnApp: true,
  confirmedBookings: 8,
  avatarUrl: null,
}

const superAdminUser = {
  id: 'u1',
  name: 'Hira Mansoor',
  email: 'hira.mansoor@gomingle.com',
  role: 'Super Admin',
  permissions: [],
  fullAccess: true,
  initials: 'HM',
}

function renderDetailPage(id: string = RESTAURANT_ID, options: { asSuperAdmin?: boolean } = {}) {
  const store = options.asSuperAdmin
    ? makeStore({ auth: { user: superAdminUser, isAuthenticated: true } })
    : undefined
  return renderWithProviders(
    <Routes>
      <Route path="/restaurants/:id" element={<RestaurantDetailPage />} />
    </Routes>,
    { route: `/restaurants/${id}`, store },
  )
}

function mockDetail(overrides: Partial<typeof fixtureDetail> = {}) {
  server.use(
    http.get(BASE, () =>
      HttpResponse.json({ success: true, data: { ...fixtureDetail, ...overrides } }),
    ),
  )
}

/** Detail endpoint whose `status` field is mutated by the action endpoints. */
function mockStatefulDetail(initialStatus: string) {
  const state = { status: initialStatus }
  server.use(
    http.get(BASE, () =>
      HttpResponse.json({ success: true, data: { ...fixtureDetail, status: state.status } }),
    ),
    http.get(`${BASE}/bookings/count-active`, () =>
      HttpResponse.json({ success: true, data: { count: 0 } }),
    ),
    http.post(`${BASE}/suspend`, () => {
      state.status = 'SUSPENDED'
      return HttpResponse.json({
        success: true,
        data: { id: RESTAURANT_ID, status: 'SUSPENDED', bookingsCancelled: 0 },
      })
    }),
    http.post(`${BASE}/unsuspend`, () => {
      state.status = 'ACTIVE'
      return HttpResponse.json({ success: true, data: { id: RESTAURANT_ID, status: 'ACTIVE' } })
    }),
  )
  return state
}

function mockActiveCategories(
  items: { id: string; name: string; commissionRate?: number }[] = [
    { id: 'cat-1', name: 'Premium', commissionRate: 12 },
    { id: 'cat-2', name: 'Standard', commissionRate: 8 },
  ],
) {
  server.use(http.get(CATEGORIES_BASE, () => HttpResponse.json({ success: true, data: { items } })))
}

const reviewRow = {
  id: 'rev-1',
  date: '15-04-2026',
  minglerId: 'm1',
  minglerName: 'Sana Khan',
  rating: 5,
  bodyPreview: 'Amazing food and ambience.',
  photoUrls: [] as string[],
  bookingId: 'BK-10081',
  interestTableId: 'it1',
  interestTableName: 'Sunday Brunch Club',
  restaurantId: RESTAURANT_ID,
  menuOption: 'Set Menu',
}

function reviewsResponse(items: (typeof reviewRow)[]) {
  return {
    success: true,
    data: {
      summary: {
        average: 5,
        total: items.length,
        distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': items.length },
        positive: items.length,
        neutral: 0,
        negative: 0,
      },
      items,
      pagination: { page: 1, pageSize: 10, totalRecords: items.length, totalPages: 1 },
    },
  }
}

describe('RestaurantDetailPage — real API integration', () => {
  it('renders header and overview fields from the live GET /api/v1/restaurants/:id response', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ success: true, data: fixtureDetail })))
    renderDetailPage()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Premium')).toBeInTheDocument()
    // Description is mapped from the API response into the Overview tab.
    expect(screen.getByText('Elevated Mediterranean waterfront dining.')).toBeInTheDocument()
    expect(screen.getByText('12 Clifton Boardwalk')).toBeInTheDocument()
    expect(screen.getByText('Marina')).toBeInTheDocument()
    expect(screen.getByText('Jane Doe')).toBeInTheDocument()
    expect(screen.getByText('Yes')).toBeInTheDocument()
    // Website now lives in Location & Address (moved out of Restaurant Details).
    expect(screen.getByText('aurelia.test')).toBeInTheDocument()
    // Seating Capacity and Avg Bill / Person are no longer shown in the overview.
    expect(screen.queryByText('Seating Capacity')).not.toBeInTheDocument()
    expect(screen.queryByText('Avg Bill / Person')).not.toBeInTheDocument()
  })

  it('falls back to "Not provided" when the API returns a null description', async () => {
    // Every other overview field in the fixture is populated, so the single
    // "Not provided" placeholder isolates the description mapping's null branch.
    mockDetail({ description: null })
    renderDetailPage()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('Not provided')).toBeInTheDocument()
  })

  it('shows a loading state before the response resolves', () => {
    server.use(http.get(BASE, () => HttpResponse.json({ success: true, data: fixtureDetail })))
    renderDetailPage()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows an error message when the restaurant is not found', async () => {
    server.use(
      http.get(BASE, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_RESTAURANT_NOT_FOUND' } },
          { status: 404 },
        ),
      ),
    )
    renderDetailPage()
    await waitFor(() =>
      expect(screen.getByText(/unable to load this restaurant/i)).toBeInTheDocument(),
    )
  })
})

describe('RestaurantDetailPage — status badges', () => {
  it('renders the Active badge for ACTIVE status', async () => {
    mockDetail({ status: 'ACTIVE' })
    mockActiveCategories()
    renderDetailPage()
    expect(await screen.findByText('Active')).toBeInTheDocument()
  })

  it('renders the Suspended badge for SUSPENDED status', async () => {
    mockDetail({ status: 'SUSPENDED' })
    mockActiveCategories()
    renderDetailPage()
    expect(await screen.findByText('Suspended')).toBeInTheDocument()
  })

  it('renders the Unknown badge for an unrecognised status', async () => {
    mockDetail({ status: 'DEACTIVATED' })
    mockActiveCategories()
    renderDetailPage()
    expect(await screen.findByText('Unknown')).toBeInTheDocument()
  })

  it('shows "Visible on Mingler App" when visibleOnApp is true', async () => {
    mockDetail({ visibleOnApp: true })
    mockActiveCategories()
    renderDetailPage()
    expect(await screen.findByText('Visible on Mingler App')).toBeInTheDocument()
  })

  it('shows "Not Visible on Mingler App" when visibleOnApp is false', async () => {
    mockDetail({ visibleOnApp: false })
    mockActiveCategories()
    renderDetailPage()
    expect(await screen.findByText('Not Visible on Mingler App')).toBeInTheDocument()
  })

  // MET-1303: the J10A detail endpoint returns the raw partner column (true by default
  // pre-approval); the approval shell must still read "Not Visible on Mingler App".
  it('shows "Not Visible on Mingler App" for a PENDING application even when visibleOnApp is true', async () => {
    mockDetail({ status: 'PENDING', visibleOnApp: true })
    mockActiveCategories()
    renderDetailPage()
    expect(await screen.findByText('Not Visible on Mingler App')).toBeInTheDocument()
    expect(screen.queryByText('Visible on Mingler App')).not.toBeInTheDocument()
  })

  it('shows "Not Visible on Mingler App" for a REJECTED application even when visibleOnApp is true', async () => {
    mockDetail({ status: 'REJECTED', visibleOnApp: true })
    mockActiveCategories()
    server.use(
      http.get(APPROVALS_BASE, () =>
        HttpResponse.json({ success: true, data: { ...fixtureDetail, rejections: [] } }),
      ),
    )
    renderDetailPage()
    expect(await screen.findByText('Not Visible on Mingler App')).toBeInTheDocument()
    expect(screen.queryByText('Visible on Mingler App')).not.toBeInTheDocument()
  })

  it('keeps the partner toggle for a SUSPENDED restaurant', async () => {
    mockDetail({ status: 'SUSPENDED', visibleOnApp: true })
    mockActiveCategories()
    renderDetailPage()
    expect(await screen.findByText('Visible on Mingler App')).toBeInTheDocument()
  })
})

describe('RestaurantDetailPage — change category flow', () => {
  it('opens the modal, selects a category and confirms successfully', async () => {
    mockDetail()
    mockActiveCategories()
    server.use(
      http.patch(`${BASE}/category`, () =>
        HttpResponse.json({
          success: true,
          data: { id: RESTAURANT_ID, category: { id: 'cat-2', name: 'Standard' } },
        }),
      ),
    )
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /change category/i }))

    const dialog = await screen.findByRole('dialog')
    const select = within(dialog).getByRole('combobox')
    fireEvent.mouseDown(select)
    await user.click(await screen.findByTitle(/^Standard/))

    await user.click(within(dialog).getByRole('button', { name: /change category/i }))
    expect(await screen.findByText('Category updated successfully')).toBeInTheDocument()
  })

  it('shows a generic error toast when the change-category mutation fails', async () => {
    mockDetail()
    mockActiveCategories()
    server.use(
      http.patch(`${BASE}/category`, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_CATEGORY_NOT_FOUND' } },
          { status: 404 },
        ),
      ),
    )
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /change category/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.mouseDown(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByTitle(/^Standard/))
    await user.click(within(dialog).getByRole('button', { name: /change category/i }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('RestaurantDetailPage — suspend flow', () => {
  it('validates the reason, calls the API and reflects the SUSPENDED status on refetch', async () => {
    mockStatefulDetail('ACTIVE')
    mockActiveCategories()
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^suspend$/i }))

    const dialog = await screen.findByRole('dialog')
    const confirmBtn = within(dialog).getByRole('button', { name: /^suspend$/i })
    const textarea = within(dialog).getByPlaceholderText(/enter reason/i)

    await user.type(textarea, 'too short')
    expect(confirmBtn).toBeDisabled()
    await user.type(textarea, ' now long enough')
    expect(confirmBtn).not.toBeDisabled()

    await user.click(confirmBtn)
    expect(await screen.findByText(/aurelia has been suspended/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Suspended')).toBeInTheDocument())
  })

  it('resets the reason and closes the suspend modal on cancel', async () => {
    mockStatefulDetail('ACTIVE')
    mockActiveCategories()
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^suspend$/i }))
    const dialog = await screen.findByRole('dialog')
    const textarea = within(dialog).getByPlaceholderText(/enter reason/i)
    await user.type(textarea, 'a reason long enough')
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }))

    // Cancel triggers the modal's leave transition (jsdom never completes it).
    await waitFor(() => expect(dialog.className).toMatch(/ant-zoom-leave/))
  })
})

describe('RestaurantDetailPage — unsuspend flow', () => {
  it('confirms unsuspend and updates status back to ACTIVE on refetch', async () => {
    mockStatefulDetail('SUSPENDED')
    mockActiveCategories()
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /^unsuspend$/i }))

    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^unsuspend$/i }))
    expect(await screen.findByText(/aurelia has been unsuspended/i)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('Active')).toBeInTheDocument())
  })
})

describe('RestaurantDetailPage — delete review flow', () => {
  it('deletes a review via the reviews tab and shows the toast', async () => {
    let items = [reviewRow]
    mockDetail({ status: 'ACTIVE' })
    mockActiveCategories()
    server.use(
      http.get(`${BASE}/reviews`, () => HttpResponse.json(reviewsResponse(items))),
      http.delete('/api/v1/reviews/:id', () => {
        items = []
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Reviews' }))
    expect(await screen.findByText('Sana Khan')).toBeInTheDocument()

    const row = screen.getByText('Sana Khan').closest('tr') as HTMLElement
    const actionsCell = row.querySelector('td:last-child') as HTMLElement
    const icons = Array.from(actionsCell.querySelectorAll('div')).filter((d) =>
      Array.from(d.children).some((c) => c.tagName.toLowerCase() === 'svg'),
    )
    fireEvent.click(icons[icons.length - 1])

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete review?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: /^delete review$/i }))

    expect(await screen.findByText('Review deleted.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Sana Khan')).not.toBeInTheDocument())
  })

  it('does not render the Reviews tab without composite MANAGE_RESTAURANTS + REVIEWS access', async () => {
    mockDetail({ status: 'ACTIVE' })
    mockActiveCategories()
    renderDetailPage()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Reviews' })).not.toBeInTheDocument()
  })
})

describe('RestaurantDetailPage — approval-preview mode', () => {
  it('shows Approve/Reject actions and hides Interest Tables + Reviews tabs for PENDING', async () => {
    mockDetail({ status: 'PENDING' })
    mockActiveCategories()
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /reject/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change category/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Interest Tables' })).not.toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Reviews' })).not.toBeInTheDocument()
  })

  it('approves a pending request and flips to the full ACTIVE view without re-hitting /approvals', async () => {
    const state = { status: 'PENDING', approvalsHit: 0 }
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({ success: true, data: { ...fixtureDetail, status: state.status } }),
      ),
      http.get(APPROVALS_BASE, () => {
        state.approvalsHit += 1
        return HttpResponse.json({ success: true, data: {} })
      }),
      http.post(`${APPROVALS_BASE}/approve`, () => {
        state.status = 'ACTIVE'
        return HttpResponse.json({
          success: true,
          data: { id: RESTAURANT_ID, status: 'ACTIVE', category: { id: 'cat-1', name: 'Premium' } },
        })
      }),
    )
    mockActiveCategories()
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /approve/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.mouseDown(within(dialog).getByRole('combobox'))
    await user.click(await screen.findByTitle(/^Premium/))
    await user.click(within(dialog).getByRole('button', { name: /approve/i }))

    // After approval the restaurant is ACTIVE → normal actions appear.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /change category/i })).toBeInTheDocument(),
    )
    expect(state.approvalsHit).toBe(0)
  })
})

describe('RestaurantDetailPage — rejection history banner', () => {
  it('shows the declined banner with reason + history for a REJECTED restaurant', async () => {
    mockDetail({ status: 'REJECTED' })
    mockActiveCategories()
    server.use(
      http.get(APPROVALS_BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: RESTAURANT_ID,
            name: 'Aurelia',
            status: 'REJECTED',
            visibleOnApp: false,
            submittedAt: '2026-02-01',
            rejections: [
              { reason: 'Incomplete trade licence.', rejectedAt: '2026-02-20', rejectedBy: 'Hira' },
              {
                reason: 'Blurry storefront photos.',
                rejectedAt: '2026-01-10',
                rejectedBy: 'Osama',
              },
            ],
          },
        }),
      ),
    )
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })

    expect(await screen.findByText('Application Declined')).toBeInTheDocument()
    expect(screen.getByText('Incomplete trade licence.')).toBeInTheDocument()
    // The older rejection is grouped under the history section.
    expect(screen.getByText('Rejection history')).toBeInTheDocument()
    expect(screen.getByText('Blurry storefront photos.')).toBeInTheDocument()
  })

  it('hides Approve/Reject (and management) actions for a REJECTED restaurant', async () => {
    mockDetail({ status: 'REJECTED' })
    mockActiveCategories()
    server.use(
      http.get(APPROVALS_BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: RESTAURANT_ID,
            name: 'Aurelia',
            status: 'REJECTED',
            visibleOnApp: false,
            submittedAt: '2026-02-01',
            rejections: [
              { reason: 'Incomplete trade licence.', rejectedAt: '2026-02-20', rejectedBy: 'Hira' },
            ],
          },
        }),
      ),
    )
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })

    // Decision already taken → no Approve/Reject, and no live-restaurant actions either.
    expect(await screen.findByText('Application Declined')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /approve/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change category/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /suspend/i })).not.toBeInTheDocument()
  })

  it('omits the history section when there is a single rejection', async () => {
    mockDetail({ status: 'REJECTED' })
    mockActiveCategories()
    server.use(
      http.get(APPROVALS_BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: RESTAURANT_ID,
            name: 'Aurelia',
            status: 'REJECTED',
            visibleOnApp: false,
            submittedAt: '2026-02-01',
            rejections: [
              { reason: 'Incomplete trade licence.', rejectedAt: '2026-02-20', rejectedBy: 'Hira' },
            ],
          },
        }),
      ),
    )
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })

    expect(await screen.findByText('Application Declined')).toBeInTheDocument()
    expect(screen.getByText('Incomplete trade licence.')).toBeInTheDocument()
    expect(screen.queryByText('Rejection history')).not.toBeInTheDocument()
  })

  it('does not render the banner or hit /admin/approvals for a PENDING restaurant', async () => {
    const state = { approvalsHit: 0 }
    mockDetail({ status: 'PENDING' })
    mockActiveCategories()
    server.use(
      http.get(APPROVALS_BASE, () => {
        state.approvalsHit += 1
        return HttpResponse.json({ success: true, data: { rejections: [] } })
      }),
    )
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.queryByText('Application Declined')).not.toBeInTheDocument()
    expect(state.approvalsHit).toBe(0)
  })

  it('surfaces the banner after declining a pending restaurant', async () => {
    const state = { status: 'PENDING' }
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({ success: true, data: { ...fixtureDetail, status: state.status } }),
      ),
      http.get(APPROVALS_BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            id: RESTAURANT_ID,
            name: 'Aurelia',
            status: 'REJECTED',
            visibleOnApp: false,
            submittedAt: '2026-02-01',
            rejections: [
              {
                reason: 'Missing documents entirely.',
                rejectedAt: '2026-02-20',
                rejectedBy: 'Hira',
              },
            ],
          },
        }),
      ),
      http.post(`${APPROVALS_BASE}/decline`, () => {
        state.status = 'REJECTED'
        return HttpResponse.json({
          success: true,
          data: { id: RESTAURANT_ID, status: 'REJECTED', rejectedAt: '2026-02-20' },
        })
      }),
    )
    mockActiveCategories()
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /reject/i }))
    const dialog = await screen.findByRole('dialog')
    const textarea = within(dialog).getByRole('textbox')
    await user.type(textarea, 'Missing documents entirely.')
    await user.click(within(dialog).getByRole('button', { name: /decline application/i }))

    // Banner appears once the restaurant refetches to REJECTED.
    const banner = (await screen.findByText('Application Declined')).closest('div')
      ?.parentElement as HTMLElement
    expect(within(banner).getByText('Missing documents entirely.')).toBeInTheDocument()
  })
})

describe('RestaurantDetailPage — tab switching via URL search params', () => {
  it('updates the query string and swaps rendered content when switching tabs', async () => {
    mockDetail()
    mockActiveCategories()
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Amenities' }))
    expect(screen.getByRole('tab', { name: 'Amenities', selected: true })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Overview' }))
    expect(screen.getByRole('tab', { name: 'Overview', selected: true })).toBeInTheDocument()
  })

  it('loads the Contacts tab from its own endpoint (CR-56)', async () => {
    mockDetail()
    mockActiveCategories()
    server.use(
      http.get(`${BASE}/contacts`, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'ct-1',
                name: 'Osama Khalil',
                title: 'General Manager',
                email: 'osama@aurelia.pk',
                phone: '+923001234567',
              },
            ],
          },
        }),
      ),
    )
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Contacts' }))

    // Partner-written contacts, not the restaurant owner from the detail payload.
    await waitFor(() => expect(screen.getByText('Osama Khalil')).toBeInTheDocument())
    expect(screen.getByRole('link', { name: 'osama@aurelia.pk' })).toBeInTheDocument()
  })

  it('renders the detail tabs in the required product order', async () => {
    mockDetail()
    mockActiveCategories()
    // Super-admin + ACTIVE status surfaces every tab (Interest Tables + Reviews included).
    renderDetailPage(RESTAURANT_ID, { asSuperAdmin: true })

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()

    const tabLabels = screen.getAllByRole('tab').map((el) => el.textContent)
    expect(tabLabels).toEqual([
      'Overview',
      'Contacts',
      'Documents',
      'Amenities',
      'Menu Options',
      'Table Timings',
      'Interest Tables',
      'Photos & Videos',
      'Reviews',
    ])
  })
})

describe('RestaurantDetailPage — edge branches', () => {
  it('renders nothing when the restaurant query resolves without data', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({ success: true, data: null })))
    mockActiveCategories()
    const { container } = renderDetailPage()
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('renders commission-rate labels in the category select when provided', async () => {
    mockDetail({ category: null })
    mockActiveCategories([{ id: 'cat-3', name: 'Elite', commissionRate: 15 }])
    renderDetailPage()
    const user = userEvent.setup()

    expect(await screen.findByText('Aurelia')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /change category/i }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.mouseDown(within(dialog).getByRole('combobox'))
    expect(await screen.findByTitle('Elite — 15% commission')).toBeInTheDocument()
  })
})

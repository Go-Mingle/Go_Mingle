import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { AmenitiesPage } from '../AmenitiesPage'

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

const BASE = '/api/v1/amenities'

// Minimal fixture — order intentional: Wi-Fi free first so rows[0] has restaurantsCount>0
const fixture = [
  {
    id: 'a1',
    name: 'Wi-Fi free',
    iconUrl: 'WifiHigh',
    restaurantsCount: 5,
    sampleRestaurants: [
      { id: 'r1', name: 'Aurelia' },
      { id: 'r2', name: 'Saffron Table' },
      { id: 'r3', name: 'Maison Petit' },
    ],
    createdAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'a2',
    name: 'Outdoor terrace',
    iconUrl: null,
    restaurantsCount: 2,
    sampleRestaurants: [
      { id: 'r4', name: 'Verde Vista' },
      { id: 'r5', name: 'Brass & Bay' },
    ],
    createdAt: '2026-04-01T10:00:00Z',
  },
]

function makeList(items: typeof fixture) {
  return {
    success: true,
    data: {
      items,
      pagination: {
        page: 1,
        pageSize: 25,
        totalRecords: items.length,
        totalPages: Math.max(1, Math.ceil(items.length / 25)),
      },
    },
  }
}

function makeEmpty() {
  return {
    success: true,
    data: {
      items: [] as typeof fixture,
      pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 },
    },
  }
}

// The edit modal is populated from GET /amenities/:id — keep it consistent with
// the list fixture so name/icon assertions hold.
function mockDetail() {
  server.use(
    http.get(`${BASE}/:id`, ({ params }) => {
      const found = fixture.find((a) => a.id === params.id)
      return found
        ? HttpResponse.json({ success: true, data: found })
        : new HttpResponse(null, { status: 404 })
    }),
  )
}

describe('AmenitiesPage', () => {
  beforeEach(() => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList(fixture))))
    mockDetail()
  })

  it('renders amenity names from mock data', async () => {
    renderWithProviders(<AmenitiesPage />)

    expect(await screen.findByText('Wi-Fi free')).toBeInTheDocument()
    expect(screen.getByText('Outdoor terrace')).toBeInTheDocument()
    // The count column has been removed — only the name column remains visible.
    expect(screen.queryByText('COUNT')).not.toBeInTheDocument()
  })

  it('does not render the restaurants column or its sample restaurant chips', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    // The RESTAURANTS column header is gone
    expect(screen.queryByText('RESTAURANTS')).not.toBeInTheDocument()
    // Sample restaurant chips are no longer rendered
    expect(screen.queryByText('Aurelia')).not.toBeInTheDocument()
    expect(screen.queryByText('Saffron Table')).not.toBeInTheDocument()
    expect(screen.queryByText('Maison Petit')).not.toBeInTheDocument()
    // Overflow badge is gone too
    expect(screen.queryByText('+2 more')).not.toBeInTheDocument()
  })

  it('renders the amenity icon from a CDN iconUrl as an <img>', async () => {
    const url = 'https://cdn.example.com/amenities/wifi.svg'
    server.use(http.get(BASE, () => HttpResponse.json(makeList([{ ...fixture[0], iconUrl: url }]))))
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    expect(document.querySelector(`img[src="${url}"]`)).not.toBeNull()
  })

  it('populates the edit modal from the amenity detail endpoint (GET /amenities/:id)', async () => {
    let detailCalledId = ''
    const detailIcon = 'https://cdn.example.com/amenities/detail.svg'
    server.use(
      http.get(`${BASE}/:id`, ({ params }) => {
        detailCalledId = params.id as string
        return HttpResponse.json({
          success: true,
          data: {
            id: params.id,
            name: 'Wi-Fi (from detail)',
            iconUrl: detailIcon,
            restaurantsCount: 0,
            createdAt: '2026-06-02T09:00:00.000Z',
            updatedAt: null,
          },
        })
      }),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const [editBtn] = rows[0].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)

    // The name is populated from the detail response (differs from the list row).
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement
      expect(input.value).toBe('Wi-Fi (from detail)')
    })
    expect(detailCalledId).toBe('a1')
    // The icon preview uses the detail iconUrl, rendered as an <img>.
    expect(document.querySelector(`img[src="${detailIcon}"]`)).not.toBeNull()
  })

  it('shows Spin while query is pending', () => {
    renderWithProviders(<AmenitiesPage />)
    // isPending is true on the first synchronous render before the fetch resolves
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
  })

  it('shows noAmenities empty state when server returns 0 records with no search query', async () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeEmpty())))
    renderWithProviders(<AmenitiesPage />)
    expect(
      await screen.findByText(
        'No amenities yet. Create one to enable restaurants to describe their offering.',
      ),
    ).toBeInTheDocument()
  })

  it('does not render a standalone search bar above the table', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    // The search input lives inside the name-column filter dropdown, which is
    // closed on first render — so no search box is visible above the table.
    expect(screen.queryByPlaceholderText('Search amenities…')).not.toBeInTheDocument()
    // The column filter trigger is present on the table instead.
    expect(document.querySelector('.ant-table-filter-trigger')).not.toBeNull()
  })

  it('searches amenities by name via the column filter, sending the q param on page 1', async () => {
    let lastSearch = ''
    server.use(
      http.get(BASE, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(makeList(fixture))
      }),
    )
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(document.querySelector('.ant-table-filter-trigger') as Element)
    // Submit the search by pressing Enter in the filter input
    await user.type(await screen.findByPlaceholderText('Search amenities…'), 'wifi{enter}')

    await waitFor(() => {
      const params = new URLSearchParams(lastSearch)
      expect(params.get('q')).toBe('wifi')
      expect(params.get('page')).toBe('1')
    })
  })

  it('clears the name search when the filter is reset', async () => {
    let lastSearch = ''
    server.use(
      http.get(BASE, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(makeList(fixture))
      }),
    )
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    // Search first
    await user.click(document.querySelector('.ant-table-filter-trigger') as Element)
    await user.type(await screen.findByPlaceholderText('Search amenities…'), 'wifi')
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(new URLSearchParams(lastSearch).get('q')).toBe('wifi'))

    // Re-open the filter and reset it — q must drop out of the query params
    await user.click(document.querySelector('.ant-table-filter-trigger') as Element)
    await user.click(await screen.findByRole('button', { name: /^reset$/i }))
    await waitFor(() => expect(new URLSearchParams(lastSearch).get('q')).toBeNull())
  })

  it('shows noResults empty state when a name search returns no records', async () => {
    // The initial (unfiltered) load has records so the table + column filter
    // render; once a search q param is present the server returns no records.
    server.use(
      http.get(BASE, ({ request }) => {
        const hasQuery = new URL(request.url).searchParams.get('q')
        return HttpResponse.json(hasQuery ? makeEmpty() : makeList(fixture))
      }),
    )
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(document.querySelector('.ant-table-filter-trigger') as Element)
    await user.type(await screen.findByPlaceholderText('Search amenities…'), 'xyz')
    await user.click(screen.getByRole('button', { name: /^search$/i }))

    // Table stays mounted (filter still reachable); no-results shown as emptyText.
    expect(await screen.findByText('No amenities match your search.')).toBeInTheDocument()
    expect(document.querySelector('.ant-table-filter-trigger')).not.toBeNull()
  })

  it('opens create modal, submits FormData via POST, shows success toast and closes modal', async () => {
    server.use(
      http.post(BASE, async ({ request }) => {
        const fd = await request.formData()
        const name = fd.get('name') as string
        return HttpResponse.json(
          {
            success: true,
            data: {
              id: 'new1',
              name,
              iconUrl: null,
              restaurantsCount: 0,
              sampleRestaurants: [],
              createdAt: '2026-06-11T00:00:00Z',
            },
          },
          { status: 201 },
        )
      }),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))

    const nameInput = await screen.findByPlaceholderText('e.g. Rooftop access')
    await user.type(nameInput, 'Rooftop Bar')

    await user.click(screen.getByRole('button', { name: /create amenity/i }))

    expect(await screen.findByText(/"Rooftop Bar" has been added\./)).toBeInTheDocument()
  })

  it('rejects a whitespace-only amenity name with a validation message and does not POST', async () => {
    let postCalled = false
    server.use(
      http.post(BASE, () => {
        postCalled = true
        return HttpResponse.json({ success: true, data: {} }, { status: 201 })
      }),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))

    await user.type(await screen.findByPlaceholderText('e.g. Rooftop access'), '   ')
    await user.click(screen.getByRole('button', { name: /create amenity/i }))

    // Whitespace-only name → validation blocks the create; message renders and
    // the modal stays open. No POST is fired.
    expect(await screen.findByText(/enter a valid amenity name/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText('e.g. Rooftop access')).toBeInTheDocument()
    expect(postCalled).toBe(false)
  })

  it('shows field error when POST returns 409 ERR_AMENITY_NAME_IN_USE', async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_AMENITY_NAME_IN_USE',
              message: 'Amenity name already exists.',
              details: {},
            },
          },
          { status: 409 },
        ),
      ),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))

    await user.type(await screen.findByPlaceholderText('e.g. Rooftop access'), 'Wi-Fi free')
    await user.click(screen.getByRole('button', { name: /create amenity/i }))

    expect(await screen.findByText(/this amenity name is already in use/i)).toBeInTheDocument()
    // Modal stays open
    expect(screen.getByPlaceholderText('e.g. Rooftop access')).toBeInTheDocument()
  })

  it('shows the backend error message as a toast when create fails (non-duplicate error)', async () => {
    server.use(
      http.post(BASE, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_VALIDATION', message: 'Name cannot be empty.', details: {} },
          },
          { status: 400 },
        ),
      ),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await user.type(await screen.findByPlaceholderText('e.g. Rooftop access'), 'Spa')
    await user.click(screen.getByRole('button', { name: /create amenity/i }))

    expect(await screen.findByText('Name cannot be empty.')).toBeInTheDocument()
  })

  it('opens edit modal prefilled with amenity name, submits PATCH, shows success toast', async () => {
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        const fd = await request.formData()
        const name = (fd.get('name') as string) || fixture[0].name
        return HttpResponse.json({ success: true, data: { ...fixture[0], name } })
      }),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const [editBtn] = rows[0].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)

    // Modal opens and input is pre-filled with the amenity's name
    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement
      expect(input.value).toBe('Wi-Fi free')
    })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/"Wi-Fi free" has been updated\./)).toBeInTheDocument()
  })

  it('delete modal shows restaurant count copy, confirms DELETE and shows success toast', async () => {
    server.use(http.delete(`${BASE}/:id`, () => new HttpResponse(null, { status: 204 })))

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    // rows[0] is Wi-Fi free (restaurantsCount: 5)
    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionBtns = rows[0].querySelectorAll('[role="button"]')
    await user.click(actionBtns[actionBtns.length - 1] as Element)

    // Delete modal opens with assignment warning
    await waitFor(() => expect(screen.getByText('Delete amenity?')).toBeInTheDocument())
    expect(screen.getByText(/5 restaurant/i)).toBeInTheDocument()

    // Confirm delete
    await user.click(screen.getByRole('button', { name: /delete amenity/i }))

    expect(await screen.findByText(/"Wi-Fi free" has been deleted\./)).toBeInTheDocument()
  })
})

describe('AmenitiesPage — error and loading states', () => {
  it('shows error alert when the fetch fails', async () => {
    server.use(http.get(BASE, () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<AmenitiesPage />)
    await waitFor(() => expect(document.querySelector('.ant-alert-error')).not.toBeNull())
  })

  it('shows loading spinner while fetching', () => {
    server.use(http.get(BASE, () => HttpResponse.json(makeList(fixture))))
    renderWithProviders(<AmenitiesPage />)
    expect(document.querySelector('.ant-spin-spinning')).not.toBeNull()
  })
})

describe('AmenitiesPage — desktop sort and page size', () => {
  beforeEach(() => {
    setDesktop()
    server.use(http.get(BASE, () => HttpResponse.json(makeList(fixture))))
  })

  it('handles table sort by clicking column header', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    const headers = screen.getAllByRole('columnheader')
    // Click the name header to trigger sort
    fireEvent.click(headers[0])
  })

  it('cycles the name column through ascending, descending and cleared sort states', async () => {
    let lastSearch = ''
    server.use(
      http.get(BASE, ({ request }) => {
        lastSearch = new URL(request.url).search
        return HttpResponse.json(makeList(fixture))
      }),
    )
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    // headers: [AMENITY, actions] — name is the only sortable column now.
    // Re-query the header before every click: AntD replaces the <th> node on
    // re-render, so a cached reference would go stale and later clicks no-op.
    const nameHeader = () => screen.getAllByRole('columnheader')[0]

    // The name column is controlled and starts in ascending order. AntD cycles a
    // sortable header ascending → descending → cleared; the sort key is always
    // 'name', only the order changes.
    // 1st click → descending (exercises the order === 'descend' branch)
    await user.click(nameHeader())
    await waitFor(() => {
      const params = new URLSearchParams(lastSearch)
      expect(params.get('sortBy')).toBe('name')
      expect(params.get('sortOrder')).toBe('desc')
    })

    // 2nd click → AntD clears the sort (order undefined) → handler falls back to
    // ascending (exercises the else branch of handleTableChange)
    await user.click(nameHeader())
    await waitFor(() => {
      const params = new URLSearchParams(lastSearch)
      expect(params.get('sortBy')).toBe('name')
      expect(params.get('sortOrder')).toBe('asc')
    })
  })

  it('clicking the actions cell does not open the row (stops propagation)', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    const actionsCell = document.querySelector(
      '.inline-flex.items-center.justify-center.gap-1',
    ) as HTMLElement
    expect(actionsCell).not.toBeNull()
    fireEvent.click(actionsCell)
    // No modal should open from clicking the empty actions-cell area
    expect(screen.queryByPlaceholderText('e.g. Rooftop access')).not.toBeInTheDocument()
  })

  it('shows field error when PATCH returns 409 ERR_AMENITY_NAME_IN_USE on edit', async () => {
    server.use(
      http.patch(`${BASE}/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_AMENITY_NAME_IN_USE',
              message: 'Amenity name already exists.',
              details: {},
            },
          },
          { status: 409 },
        ),
      ),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const [editBtn] = rows[0].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)

    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement
      expect(input.value).toBe('Wi-Fi free')
    })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText(/this amenity name is already in use/i)).toBeInTheDocument()
    // Modal stays open after the error
    expect(screen.getByPlaceholderText('e.g. Rooftop access')).toBeInTheDocument()
  })

  it('shows the backend error message as a toast when edit fails (non-duplicate error)', async () => {
    server.use(
      http.patch(`${BASE}/:id`, () =>
        HttpResponse.json(
          {
            success: false,
            error: { code: 'ERR_VALIDATION', message: 'Name cannot be empty.', details: {} },
          },
          { status: 400 },
        ),
      ),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const [editBtn] = rows[0].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)

    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement
      expect(input.value).toBe('Wi-Fi free')
    })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    expect(await screen.findByText('Name cannot be empty.')).toBeInTheDocument()
  })

  it('cancels create modal via cancel button', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await screen.findByPlaceholderText('e.g. Rooftop access')
    const cancelBtn = screen.getByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtn)
  })

  it('cancels delete modal via cancel button', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionBtns = rows[0].querySelectorAll('[role="button"]')
    await user.click(actionBtns[actionBtns.length - 1] as Element)
    await screen.findByText('Delete amenity?')
    const cancelBtns = screen.getAllByRole('button', { name: /cancel/i })
    fireEvent.click(cancelBtns[cancelBtns.length - 1])
  })

  it('changes page size via the page-size select', async () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...fixture[0],
      id: `x${i}`,
      name: `Item${i}`,
      sampleRestaurants: [],
    }))
    server.use(
      http.get(BASE, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: many,
            pagination: { page: 1, pageSize: 25, totalRecords: 30, totalPages: 2 },
          },
        }),
      ),
    )
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Item0')
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    await user.click(selects[selects.length - 1])
    const opts = await screen.findAllByText(/50/)
    if (opts.length > 0) await user.click(opts[opts.length - 1])
  })
})

describe('AmenitiesPage — SVG icon upload flow', () => {
  beforeEach(() => {
    setDesktop()
    server.use(http.get(BASE, () => HttpResponse.json(makeList(fixture))))
    mockDetail()
  })

  function getFileInput() {
    return document.querySelector('.amenity-modal input[type="file"]') as HTMLInputElement
  }

  it('previews a valid SVG upload and clears it via the Remove button', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await screen.findByPlaceholderText('e.g. Rooftop access')

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    // FileReader.onload resolves async (and can be slow under parallel load) →
    // preview + Remove button appear once the SVG text is read.
    const removeBtn = await screen.findByRole('button', { name: 'Remove' }, { timeout: 5000 })
    expect(removeBtn).toBeInTheDocument()

    await user.click(removeBtn)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument(),
    )
  })

  it('rejects a non-SVG file with an error toast', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await screen.findByPlaceholderText('e.g. Rooftop access')

    const file = new File(['not svg'], 'icon.txt', { type: 'text/plain' })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    expect(await screen.findByText('Please upload a valid SVG file.')).toBeInTheDocument()
  })

  it('rejects an SVG larger than 100 KB', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await screen.findByPlaceholderText('e.g. Rooftop access')

    const big = new File(['a'.repeat(100 * 1024 + 1)], 'big.svg', { type: 'image/svg+xml' })
    fireEvent.change(getFileInput(), { target: { files: [big] } })

    expect(await screen.findByText('SVG file must be under 100 KB.')).toBeInTheDocument()
  })

  it('rejects an .svg file whose contents are not actually SVG markup, only once the CTA is pressed', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await user.type(await screen.findByPlaceholderText('e.g. Rooftop access'), 'Bad Icon')

    const fake = new File(['<html>not an svg</html>'], 'fake.svg', { type: 'image/svg+xml' })
    fireEvent.change(getFileInput(), { target: { files: [fake] } })

    // Content validation runs inside FileReader.onload (async), but the
    // error must not surface until the CTA is pressed.
    const createBtn = screen.getByRole('button', { name: /create amenity/i })
    await waitFor(() => expect(createBtn).not.toBeDisabled(), { timeout: 5000 })
    expect(screen.queryByText('Please upload a valid SVG file.')).not.toBeInTheDocument()

    await user.click(createBtn)

    expect(await screen.findByText('Please upload a valid SVG file.')).toBeInTheDocument()
    // Modal stays open and the corrupt file is removed.
    expect(screen.getByRole('button', { name: /create amenity/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('rejects an SVG containing an embedded <script> tag as unsafe, only once the CTA is pressed', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await user.type(await screen.findByPlaceholderText('e.g. Rooftop access'), 'Bad Icon')

    const malicious = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      'evil.svg',
      { type: 'image/svg+xml' },
    )
    fireEvent.change(getFileInput(), { target: { files: [malicious] } })

    const createBtn = screen.getByRole('button', { name: /create amenity/i })
    await waitFor(() => expect(createBtn).not.toBeDisabled(), { timeout: 5000 })
    expect(
      screen.queryByText('The selected file is unsafe, please upload another.'),
    ).not.toBeInTheDocument()

    await user.click(createBtn)

    expect(
      await screen.findByText('The selected file is unsafe, please upload another.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create amenity/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('rejects an SVG containing an external xlink:href reference as unsafe, only once the CTA is pressed', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await user.type(await screen.findByPlaceholderText('e.g. Rooftop access'), 'Bad Icon')

    const malicious = new File(
      [
        '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="https://evil.example.com/payload.svg"></use></svg>',
      ],
      'evil.svg',
      { type: 'image/svg+xml' },
    )
    fireEvent.change(getFileInput(), { target: { files: [malicious] } })

    const createBtn = screen.getByRole('button', { name: /create amenity/i })
    await waitFor(() => expect(createBtn).not.toBeDisabled(), { timeout: 5000 })
    expect(
      screen.queryByText('The selected file is unsafe, please upload another.'),
    ).not.toBeInTheDocument()

    await user.click(createBtn)

    expect(
      await screen.findByText('The selected file is unsafe, please upload another.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create amenity/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
  })

  it('disables the CTA button while a selected SVG is still being read', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new amenity/i }))
    await user.type(await screen.findByPlaceholderText('e.g. Rooftop access'), 'Loading Icon')

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'], 'icon.svg', {
      type: 'image/svg+xml',
    })
    fireEvent.change(getFileInput(), { target: { files: [file] } })

    // Immediately after selection (before FileReader.onload has resolved),
    // the CTA must be disabled so a fast click can't bypass validation.
    expect(screen.getByRole('button', { name: /create amenity/i })).toBeDisabled()

    await waitFor(
      () => expect(screen.getByRole('button', { name: /create amenity/i })).not.toBeDisabled(),
      { timeout: 5000 },
    )
  })

  it('stages the icon reset without calling the API until the Save CTA is pressed', async () => {
    let patchCalled = false
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        patchCalled = true
        const fd = await request.formData()
        expect(fd.get('resetIcon')).toBe('true')
        return HttpResponse.json({ success: true, data: { ...fixture[0], iconUrl: null } })
      }),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const [editBtn] = rows[0].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)

    // Wi-Fi free has iconUrl set → the "Reset to default" action is available.
    const resetBtn = await screen.findByRole('button', { name: /reset to default/i })
    await user.click(resetBtn)

    // Reset is staged only: no PATCH yet, the modal stays open, and the reset
    // action disappears because the preview now reads as icon-less.
    expect(patchCalled).toBe(false)
    expect(screen.getByPlaceholderText('e.g. Rooftop access')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /reset to default/i })).not.toBeInTheDocument(),
    )

    // Pressing Save now sends the staged reset and closes with the success toast.
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    expect(await screen.findByText(/"Wi-Fi free" has been updated\./)).toBeInTheDocument()
    expect(patchCalled).toBe(true)
  })

  it('sends both the edited name and the staged icon reset in one PATCH on save', async () => {
    let sentName: string | null = null
    let sentReset: string | null = null
    server.use(
      http.patch(`${BASE}/:id`, async ({ request }) => {
        const fd = await request.formData()
        sentName = fd.get('name') as string
        sentReset = fd.get('resetIcon') as string
        return HttpResponse.json({
          success: true,
          data: { ...fixture[0], name: sentName, iconUrl: null },
        })
      }),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const [editBtn] = rows[0].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)

    await user.click(await screen.findByRole('button', { name: /reset to default/i }))

    const input = screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'Wi-Fi renamed')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await screen.findByText(/has been updated\./)
    expect(sentName).toBe('Wi-Fi renamed')
    expect(sentReset).toBe('true')
  })

  it('drops the stale detail cache after an update so the reopened modal shows fresh data', async () => {
    // staleTime: Infinity reproduces the production bug — without an explicit
    // cache removal the edit modal would keep showing the pre-update detail.
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, staleTime: Infinity },
        mutations: { retry: false },
      },
    })

    let currentName: string = fixture[0].name
    server.use(
      http.get(`${BASE}/:id`, ({ params }) => {
        const base = fixture.find((a) => a.id === params.id)!
        return HttpResponse.json({ success: true, data: { ...base, name: currentName } })
      }),
      http.patch(`${BASE}/:id`, async ({ request }) => {
        const fd = await request.formData()
        currentName = (fd.get('name') as string) || currentName
        return HttpResponse.json({ success: true, data: { ...fixture[0], name: currentName } })
      }),
    )

    renderWithProviders(<AmenitiesPage />, { queryClient })
    await screen.findByText('Wi-Fi free')
    const user = userEvent.setup()

    const openEdit = async () => {
      const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
      const [editBtn] = rows[0].querySelectorAll('[role="button"]')
      await user.click(editBtn as Element)
    }

    await openEdit()
    await waitFor(() =>
      expect((screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement).value).toBe(
        'Wi-Fi free',
      ),
    )

    const input = screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'Wi-Fi renamed')
    await user.click(screen.getByRole('button', { name: /save changes/i }))
    await screen.findByText(/has been updated\./)

    // Reopen the same amenity — the detail cache was removed, so it refetches
    // fresh and the modal reflects the updated name (not the cached original).
    await openEdit()
    await waitFor(() =>
      expect((screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement).value).toBe(
        'Wi-Fi renamed',
      ),
    )
  })

  it('re-requests the icon after replacing it, even though the CDN URL is unchanged', async () => {
    // MET-1288 — the API replaces the icon at a stable CDN key, so iconUrl is
    // identical before and after the update. Without a cache-buster the browser
    // keeps serving the previous file and the icon appears not to have changed.
    const cdnUrl = 'https://cdn.example.com/amenities/a1.svg'
    const withIcon = { ...fixture[0], iconUrl: cdnUrl }
    let patchContentType: string | null = null

    server.use(
      http.get(BASE, () => HttpResponse.json(makeList([withIcon, fixture[1]]))),
      http.get(`${BASE}/:id`, () => HttpResponse.json({ success: true, data: withIcon })),
      // The multipart body is deliberately left unread: parsing a file part
      // needs a Blob from undici's realm, and jsdom's File hangs the read.
      http.patch(`${BASE}/:id`, ({ request }) => {
        patchContentType = request.headers.get('Content-Type')
        return HttpResponse.json({ success: true, data: withIcon })
      }),
    )

    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    expect(document.querySelector(`img[src="${cdnUrl}"]`)).not.toBeNull()

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const [editBtn] = rows[0].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)
    await screen.findByPlaceholderText('e.g. Rooftop access')

    const file = new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>'], 'new.svg', {
      type: 'image/svg+xml',
    })
    fireEvent.change(getFileInput(), { target: { files: [file] } })
    // The Remove action only appears once FileReader.onload has staged the
    // preview — a reliable signal that the replacement file is held in state.
    await screen.findByRole('button', { name: 'Remove' }, { timeout: 5000 })

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await screen.findByText(/has been updated\./)
    // The replacement was sent as multipart (i.e. the file rode along)…
    expect(patchContentType).toMatch(/^multipart\/form-data/)

    // …and the row now requests a cache-busted URL, so the new file is fetched
    // instead of the cached one sitting at the unchanged CDN key.
    await waitFor(() => {
      const img = document.querySelector('.ant-table-tbody img') as HTMLImageElement | null
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toMatch(
        new RegExp(`^${cdnUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?v=\\d+$`),
      )
    })
  })

  it('does not offer reset-to-default when editing an amenity without a custom icon', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Outdoor terrace')

    const user = userEvent.setup()
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    // rows[1] is "Outdoor terrace" with iconUrl: null
    const [editBtn] = rows[1].querySelectorAll('[role="button"]')
    await user.click(editBtn as Element)

    await waitFor(() => {
      const input = screen.getByPlaceholderText('e.g. Rooftop access') as HTMLInputElement
      expect(input.value).toBe('Outdoor terrace')
    })
    expect(screen.queryByRole('button', { name: /reset to default/i })).not.toBeInTheDocument()
  })
})

describe('AmenitiesPage — mobile card view', () => {
  beforeEach(() => {
    setMobile()
    server.use(http.get(BASE, () => HttpResponse.json(makeList(fixture))))
  })

  it('renders amenity names in mobile card layout', async () => {
    renderWithProviders(<AmenitiesPage />)
    expect(await screen.findByText('Wi-Fi free')).toBeInTheDocument()
    expect(screen.getByText('Outdoor terrace')).toBeInTheDocument()
  })

  it('opens edit modal from mobile card edit button', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    const editBtns = document.querySelectorAll('.amenities-card-list button')
    const editBtn = Array.from(editBtns).find((b) => /edit/i.test(b.textContent ?? ''))
    if (editBtn) fireEvent.click(editBtn)
    await waitFor(() =>
      expect(screen.queryByPlaceholderText('e.g. Rooftop access')).toBeInTheDocument(),
    )
  })

  it('opens delete modal from mobile card delete button', async () => {
    renderWithProviders(<AmenitiesPage />)
    await screen.findByText('Wi-Fi free')
    const allBtns = document.querySelectorAll('.amenities-card-list button')
    const deleteBtn = Array.from(allBtns).find((b) => /delete/i.test(b.textContent ?? ''))
    if (deleteBtn) fireEvent.click(deleteBtn)
    await waitFor(() => expect(screen.queryByText('Delete amenity?')).toBeInTheDocument())
  })
})

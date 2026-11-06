import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

function findActionDivs(row: Element): HTMLElement[] {
  const cells = row.querySelectorAll('td')
  const last = cells[cells.length - 1]
  return Array.from(last.querySelectorAll('div')).filter((d) =>
    d.querySelector('svg'),
  ) as HTMLElement[]
}
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RolesAccessPage } from '../RolesAccessPage'

const rolesData = [
  {
    id: '1',
    name: 'Admin',
    fullAccess: true,
    permissions: [],
    usersAssigned: 3,
  },
  {
    id: '2',
    name: 'Manager',
    fullAccess: false,
    permissions: ['RESTAURANT_APPROVALS', 'MANAGE_MINGLERS'],
    usersAssigned: 0,
  },
]

beforeEach(() => {
  server.use(
    http.get('/api/v1/roles', () =>
      HttpResponse.json({
        items: rolesData,
        pagination: { page: 1, pageSize: 25, totalItems: rolesData.length, totalPages: 1 },
      }),
    ),
  )
  // Reset matchMedia to desktop default after any mobile-mutating test.
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

describe('RolesAccessPage', () => {
  it('renders title and rows', async () => {
    renderWithProviders(<RolesAccessPage />)
    expect(await screen.findByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
  })

  it('opens new role modal', async () => {
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    await userEvent.setup().click(screen.getByRole('button', { name: /new role/i }))
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument(),
    )
  })

  it('opens delete blocked modal when role has users and closes via Got it', async () => {
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const adminActions = findActionDivs(rows[0])
    const innerMost = adminActions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1] || innerMost[0])
    await waitFor(() => expect(screen.getByText(/remove users before/i)).toBeInTheDocument())
    // Close via Got it button
    const buttons = screen.getAllByRole('button')
    const gotIt = buttons.find((b) => /got it/i.test(b.textContent ?? ''))
    if (gotIt) fireEvent.click(gotIt)
  })

  it('cancels delete confirm modal via X close', async () => {
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Manager')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const mgrActions = findActionDivs(rows[1])
    const innerMost = mgrActions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1] || innerMost[0])
    await waitFor(() => expect(screen.getAllByText(/Delete role\?/i).length).toBeGreaterThan(0))
    const closeBtns = screen.getAllByLabelText('Close')
    if (closeBtns[0]) fireEvent.click(closeBtns[0])
  })

  it('confirms delete when role has 0 users', async () => {
    server.use(http.delete('/api/v1/roles/:id', () => new HttpResponse(null, { status: 204 })))
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Manager')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const mgrActions = findActionDivs(rows[1])
    const user = userEvent.setup()
    {
      const innerMost = mgrActions
        .filter((d) => d.querySelectorAll('svg').length === 1)
        .sort((a, b) => a.children.length - b.children.length)
      fireEvent.click(innerMost[1] || innerMost[0])
    }
    const buttons = await screen.findAllByRole('button')
    const delBtn = buttons.find((b) => /delete role/i.test(b.textContent ?? ''))
    if (delBtn) await user.click(delBtn)
  })

  it('opens edit modal', async () => {
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actions = findActionDivs(rows[0])
    // Click the inner-most div which contains exactly one svg (the edit pencil)
    const innerMost = actions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    if (innerMost[0]) fireEvent.click(innerMost[0])
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument(),
    )
  })

  it('renders mobile card list when isMobile=true', async () => {
    // Set a narrow viewport
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 500 })
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    window.dispatchEvent(new Event('resize'))
    // Lots of roles to trigger pagination control rendering
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      name: `Role${i}`,
      fullAccess: i === 0,
      permissions: i % 2 === 0 ? [] : ['RESTAURANT_APPROVALS', 'MANAGE_MINGLERS'],
      usersAssigned: i,
    }))
    server.use(
      http.get('/api/v1/roles', () =>
        HttpResponse.json({
          items: many,
          pagination: { page: 1, pageSize: 25, totalItems: many.length, totalPages: 1 },
        }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Role0')
    // Click edit and delete in mobile card — use fireEvent for simple clicks to avoid timeout
    const editBtns = screen.queryAllByRole('button', { name: /edit/i })
    if (editBtns[0]) fireEvent.click(editBtns[0])
    // Cancel
    const cancelBtns = screen.getAllByRole('button', { name: /cancel/i })
    if (cancelBtns[0]) fireEvent.click(cancelBtns[0])
    // Click a mobile delete on a role with usersCount=0
    const deleteBtns = screen.getAllByRole('button', { name: /delete/i })
    if (deleteBtns[0]) fireEvent.click(deleteBtns[0])
    // Trigger mobile pagination
    const nextBtn = screen.queryByTitle('Next Page')
    if (nextBtn) fireEvent.click(nextBtn)
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1280 })
  })

  it('triggers table sort filter onChange', async () => {
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const headers = screen.getAllByRole('columnheader')
    const user = userEvent.setup()
    await user.click(headers[0])
  })

  it('requests the roles list sorted by name ascending by default', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/roles', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: rolesData,
          pagination: { page: 1, pageSize: 25, totalItems: rolesData.length, totalPages: 1 },
        })
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    expect(capturedUrl).toContain('sortBy=name')
    expect(capturedUrl).toContain('sortDir=asc')
  })

  it('re-requests the roles list with sortBy=usersAssigned after clicking that column header', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/roles', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: rolesData,
          pagination: { page: 1, pageSize: 25, totalItems: rolesData.length, totalPages: 1 },
        })
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    // Column order is Role name, Modules, Users Assigned, Created — only the
    // first two sortable columns render a `.ant-table-column-sorters` wrapper.
    const sorters = document.querySelectorAll('.ant-table-column-sorters')
    await user.click(sorters[1] as HTMLElement)
    await waitFor(() => expect(capturedUrl).toContain('sortBy=usersAssigned'))
  })

  it('cycles the Role Name column through ascending → descending → no-sort on repeated clicks', async () => {
    // Regression test for the "stuck sorter" bug: the third click must reach a
    // genuine no-sort state (sort params omitted → server default order),
    // rather than flipping back to a direction forever.
    const capturedUrls: string[] = []
    server.use(
      http.get('/api/v1/roles', ({ request }) => {
        capturedUrls.push(request.url)
        return HttpResponse.json({
          items: rolesData,
          pagination: { page: 1, pageSize: 25, totalItems: rolesData.length, totalPages: 1 },
        })
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    // Default: ascending.
    expect(capturedUrls[capturedUrls.length - 1]).toContain('sortDir=asc')

    const user = userEvent.setup()
    const sorters = document.querySelectorAll('.ant-table-column-sorters')

    // Click 1: ascend → descend.
    await user.click(sorters[0] as HTMLElement)
    await waitFor(() => expect(capturedUrls[capturedUrls.length - 1]).toContain('sortDir=desc'))
    expect(capturedUrls[capturedUrls.length - 1]).toContain('sortBy=name')

    // Click 2: descend → no-sort (sort params dropped entirely).
    await user.click(sorters[0] as HTMLElement)
    await waitFor(() => {
      const last = capturedUrls[capturedUrls.length - 1]
      expect(last).not.toContain('sortBy=')
      expect(last).not.toContain('sortDir=')
    })

    // Click 3: no-sort → ascend again (toggle isn't stuck).
    await user.click(sorters[0] as HTMLElement)
    await waitFor(() => expect(capturedUrls[capturedUrls.length - 1]).toContain('sortDir=asc'))
    expect(capturedUrls[capturedUrls.length - 1]).toContain('sortBy=name')
  })

  it('searches roles by name via the Role Name column filter and resets to page 1', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/roles', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: rolesData,
          pagination: { page: 1, pageSize: 25, totalItems: rolesData.length, totalPages: 1 },
        })
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await user.type(input, 'Manager')
    const searchBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /search/i.test(b.textContent ?? ''))
    await user.click(searchBtn as HTMLElement)
    await waitFor(() => expect(capturedUrl).toContain('search=Manager'))
    expect(capturedUrl).toContain('page=1')
  })

  it('keeps the typed search text in the dropdown after the roles list refetches', async () => {
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await user.type(input, 'Manager')
    const searchBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /search/i.test(b.textContent ?? ''))
    await user.click(searchBtn as HTMLElement)
    await waitFor(() => expect(screen.getByText('Admin')).toBeInTheDocument())
    // Reopen the dropdown after the refetch completes — the typed text must
    // not have been lost (this was the reported bug).
    await user.click(filterTriggers[0] as HTMLElement)
    const reopened = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    expect(reopened.value).toBe('Manager')
  })

  it('resets the search via the Reset button and re-requests without it', async () => {
    let capturedUrl = ''
    server.use(
      http.get('/api/v1/roles', ({ request }) => {
        capturedUrl = request.url
        return HttpResponse.json({
          items: rolesData,
          pagination: { page: 1, pageSize: 25, totalItems: rolesData.length, totalPages: 1 },
        })
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await user.type(input, 'Manager')
    const searchBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /search/i.test(b.textContent ?? ''))
    await user.click(searchBtn as HTMLElement)
    await waitFor(() => expect(capturedUrl).toContain('search=Manager'))

    await user.click(filterTriggers[0] as HTMLElement)
    const resetBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /reset/i.test(b.textContent ?? ''))
    await user.click(resetBtn as HTMLElement)
    await waitFor(() => expect(capturedUrl).not.toContain('search=Manager'))

    // The dropdown itself must reflect the cleared value too.
    await user.click(filterTriggers[0] as HTMLElement)
    const reopened = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    expect(reopened.value).toBe('')
  })

  it('keeps the page mounted (header and previous rows) while a search request is in flight', async () => {
    let resolveSlow: (() => void) | undefined
    const slow = new Promise<void>((resolve) => {
      resolveSlow = resolve
    })
    server.use(
      http.get('/api/v1/roles', async ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('search') === 'Manager') {
          await slow
          return HttpResponse.json({
            items: [rolesData[1]],
            pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
          })
        }
        return HttpResponse.json({
          items: rolesData,
          pagination: { page: 1, pageSize: 25, totalItems: rolesData.length, totalPages: 1 },
        })
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await user.type(input, 'Manager')
    const searchBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /search/i.test(b.textContent ?? ''))
    await user.click(searchBtn as HTMLElement)

    // While the filtered request is still in flight, the page must stay
    // mounted — header and previous rows survive — instead of being replaced
    // by a full-page spinner (the reported "entire page reloads" bug).
    expect(screen.getByRole('button', { name: /new role/i })).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()

    resolveSlow?.()
    await waitFor(() => expect(screen.queryByText('Admin')).not.toBeInTheDocument())
    expect(screen.getByText('Manager')).toBeInTheDocument()
  })

  it('creates a new role via new role form', async () => {
    server.use(
      http.post('/api/v1/roles', async ({ request }) => HttpResponse.json(await request.json())),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new role/i }))
    // type a role name and select a module
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    await user.type(nameInput, 'TestRole')
    // toggle fullAccess (first checkbox is fullAccess)
    const cbs = screen.getAllByRole('checkbox')
    await user.click(cbs[0])
    // click create role
    const createBtn = screen.getByRole('button', { name: /create role/i })
    await user.click(createBtn)
  })

  it('saves edit of an existing role', async () => {
    server.use(
      http.patch('/api/v1/roles/:id', async ({ request }) =>
        HttpResponse.json(await request.json()),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actions = findActionDivs(rows[0])
    const innerMost = actions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0])
    const user = userEvent.setup()
    const saveBtn = await screen.findByRole('button', { name: /save changes/i })
    await user.click(saveBtn)
  })

  it('changes page size', async () => {
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    const select = screen.getAllByRole('combobox').slice(-1)[0]
    await user.click(select)
    const opts = await screen.findAllByText(/10 \/ page/i)
    await user.click(opts[opts.length - 1])
  })

  it('shows the full-access warning when editing a role fails with ERR_LAST_SUPER_ADMIN_FULL_ACCESS_REQUIRED', async () => {
    server.use(
      http.patch('/api/v1/roles/:id', () =>
        HttpResponse.json(
          { error: { code: 'ERR_LAST_SUPER_ADMIN_FULL_ACCESS_REQUIRED' } },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actions = findActionDivs(rows[0])
    const innerMost = actions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0]) // edit Admin
    const user = userEvent.setup()
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    // Change the name so onFinish does not early-return and the update mutation fires.
    await user.clear(nameInput)
    await user.type(nameInput, 'Admin Renamed')
    const saveBtn = await screen.findByRole('button', { name: /save changes/i })
    await user.click(saveBtn)
    expect(await screen.findByText(/cannot remove full access/i)).toBeInTheDocument()
  })

  it('cancels the desktop delete modal via its Cancel button', async () => {
    const deleteSpy = vi.fn()
    server.use(
      http.delete('/api/v1/roles/:id', () => {
        deleteSpy()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Manager')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const mgrActions = findActionDivs(rows[1])
    const innerMost = mgrActions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1] || innerMost[0]) // delete Manager (0 users → desktop modal)
    await waitFor(() => expect(screen.getAllByText(/Delete role\?/i).length).toBeGreaterThan(0))
    // The desktop delete modal exposes the only "Cancel" button on screen.
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteSpy).not.toHaveBeenCalled()
  })

  it('shows an error alert when the roles fetch fails', async () => {
    server.use(http.get('/api/v1/roles', () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<RolesAccessPage />)
    await waitFor(() => expect(document.querySelector('.ant-alert-error')).not.toBeNull())
  })

  it('creates a role without full access and with a selected module', async () => {
    let posted: { fullAccess?: boolean; permissions?: string[] } | null = null
    server.use(
      http.post('/api/v1/roles', async ({ request }) => {
        posted = (await request.json()) as { fullAccess: boolean; permissions: string[] }
        return HttpResponse.json(posted)
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new role/i }))
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    await user.type(nameInput, 'Limited Role')
    // Wait for the API-driven permission catalogue so module checkboxes render.
    await screen.findByText('Manage Minglers')
    // checkbox[0] is the Full Access toggle; checkbox[1] is the first module.
    const checkboxes = screen.getAllByRole('checkbox')
    await user.click(checkboxes[1])
    await user.click(screen.getByRole('button', { name: /create role/i }))
    await waitFor(() => expect(posted).not.toBeNull())
    expect(posted!.fullAccess).toBe(false)
    expect((posted!.permissions ?? []).length).toBeGreaterThan(0)
  })

  it('sends fullAccess: true when every permission is selected manually', async () => {
    let posted: { fullAccess?: boolean; permissions?: string[] } | null = null
    server.use(
      http.post('/api/v1/roles', async ({ request }) => {
        posted = (await request.json()) as { fullAccess: boolean; permissions: string[] }
        return HttpResponse.json(posted)
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new role/i }))
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    await user.type(nameInput, 'Everything Role')
    // Wait for the API-driven permission catalogue so all module checkboxes render.
    await screen.findByText('Manage Minglers')
    // Select every module checkbox by hand (index 0 is the Full Access toggle,
    // which we deliberately do NOT click).
    const moduleCheckboxes = screen.getAllByRole('checkbox').slice(1)
    for (const cb of moduleCheckboxes) {
      await user.click(cb)
    }
    await user.click(screen.getByRole('button', { name: /create role/i }))
    await waitFor(() => expect(posted).not.toBeNull())
    // Manual-all is normalised to the Full Access flow.
    expect(posted!.fullAccess).toBe(true)
    expect(posted!.permissions).toEqual([])
  })

  it('edits a role whose permissions field is undefined', async () => {
    let patched: unknown = null
    server.use(
      http.get('/api/v1/roles', () =>
        HttpResponse.json({
          items: [{ id: '9', name: 'NoPerms', fullAccess: false, usersAssigned: 0 }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        }),
      ),
      http.patch('/api/v1/roles/:id', async ({ request }) => {
        patched = await request.json()
        return HttpResponse.json(patched as Record<string, unknown>)
      }),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('NoPerms')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actions = findActionDivs(rows[0])
    const innerMost = actions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0])
    const user = userEvent.setup()
    // Toggle Full Access on so the role differs from its stored (undefined-permissions) state.
    const checkboxes = await screen.findAllByRole('checkbox')
    await user.click(checkboxes[0])
    const saveBtn = await screen.findByRole('button', { name: /save changes/i })
    await user.click(saveBtn)
    await waitFor(() => expect(patched).not.toBeNull())
  })

  it('ignores a non-matching error code when an edit fails', async () => {
    server.use(
      http.patch('/api/v1/roles/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_OTHER' } }, { status: 400 }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actions = findActionDivs(rows[0])
    const innerMost = actions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0])
    const user = userEvent.setup()
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    await user.clear(nameInput)
    await user.type(nameInput, 'Admin X')
    const saveBtn = await screen.findByRole('button', { name: /save changes/i })
    await user.click(saveBtn)
    // A non-matching code shows no warning modal; the edit modal stays open.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument(),
    )
  })

  it('shows an error toast and keeps the modal open when creating a role fails', async () => {
    server.use(
      http.post('/api/v1/roles', () =>
        HttpResponse.json({ error: { message: 'Role name already in use' } }, { status: 400 }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new role/i }))
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    await user.type(nameInput, 'TestRole')
    const cbs = screen.getAllByRole('checkbox')
    await user.click(cbs[0]) // full access → form is valid
    await user.click(screen.getByRole('button', { name: /create role/i }))
    // The API error message is surfaced as a toast…
    expect(await screen.findByText('Role name already in use')).toBeInTheDocument()
    // …and the create modal stays open so the user can retry.
    expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
  })

  it('surfaces the API message (not a hardcoded string) when a duplicate role name is rejected', async () => {
    const apiMessage = 'A role with this name already exists'
    server.use(
      http.post('/api/v1/roles', () =>
        HttpResponse.json(
          { error: { code: 'ERR_ROLE_NAME_DUPLICATE', message: apiMessage } },
          { status: 400 },
        ),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new role/i }))
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    // A name that isn't a duplicate on the loaded page, so the client-side
    // validator passes and the request reaches the (mocked) API.
    await user.type(nameInput, 'BrandNewUniqueRole')
    const cbs = screen.getAllByRole('checkbox')
    await user.click(cbs[0]) // full access → form is valid
    await user.click(screen.getByRole('button', { name: /create role/i }))
    // The exact message returned by the API is shown in the toast…
    expect(await screen.findByText(apiMessage)).toBeInTheDocument()
    // …and the create modal stays open so the user can retry.
    expect(screen.getByRole('button', { name: /create role/i })).toBeInTheDocument()
  })

  it('shows an error toast and keeps the modal open when editing a role fails', async () => {
    server.use(
      http.patch('/api/v1/roles/:id', () =>
        HttpResponse.json({ error: { message: 'Unable to update role' } }, { status: 400 }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actions = findActionDivs(rows[0])
    const innerMost = actions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0]) // edit Admin
    const user = userEvent.setup()
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    await user.clear(nameInput)
    await user.type(nameInput, 'Admin Renamed')
    await user.click(await screen.findByRole('button', { name: /save changes/i }))
    expect(await screen.findByText('Unable to update role')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('shows an error toast and keeps the modal open when deleting a role fails', async () => {
    server.use(
      http.delete('/api/v1/roles/:id', () =>
        HttpResponse.json({ error: { message: 'Unable to delete role' } }, { status: 400 }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Manager')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const mgrActions = findActionDivs(rows[1])
    const innerMost = mgrActions
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1] || innerMost[0]) // delete Manager (0 users → desktop modal)
    await waitFor(() => expect(screen.getAllByText(/Delete role\?/i).length).toBeGreaterThan(0))
    const user = userEvent.setup()
    const delBtn = (await screen.findAllByRole('button')).find((b) =>
      /delete role/i.test(b.textContent ?? ''),
    )
    await user.click(delBtn as HTMLElement)
    expect(await screen.findByText('Unable to delete role')).toBeInTheDocument()
    // The delete modal remains open (its title is still on screen).
    expect(screen.getAllByText(/Delete role\?/i).length).toBeGreaterThan(0)
  })

  it('falls back to a generic error toast when the API error has no message', async () => {
    server.use(
      http.post('/api/v1/roles', () =>
        HttpResponse.json({ error: { code: 'ERR_UNKNOWN' } }, { status: 500 }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Admin')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new role/i }))
    const nameInput = (await screen.findAllByRole('textbox'))[0]
    await user.type(nameInput, 'TestRole')
    const cbs = screen.getAllByRole('checkbox')
    await user.click(cbs[0])
    await user.click(screen.getByRole('button', { name: /create role/i }))
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('renders a mobile card for a role missing usersAssigned and permissions', async () => {
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    server.use(
      http.get('/api/v1/roles', () =>
        HttpResponse.json({
          items: [{ id: '7', name: 'Sparse', fullAccess: false }],
          pagination: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 },
        }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Sparse')
    // usersAssigned ?? 0 and permissions ?? [] fallbacks render without throwing.
    expect(screen.getByText('Sparse')).toBeInTheDocument()
  })

  it('changes page via the mobile pagination control', async () => {
    ;(window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation((q: string) => ({
      matches: /max-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `r${i}`,
      name: `Role${i}`,
      fullAccess: false,
      permissions: [],
      usersAssigned: i,
    }))
    server.use(
      http.get('/api/v1/roles', () =>
        HttpResponse.json({
          // totalItems exceeds the page size so the mobile Pagination renders 2+ pages.
          items: many,
          pagination: { page: 1, pageSize: 25, totalItems: 60, totalPages: 3 },
        }),
      ),
    )
    renderWithProviders(<RolesAccessPage />)
    await screen.findByText('Role0')
    const nextBtn = screen.queryByTitle('Next Page')
    expect(nextBtn).not.toBeNull()
    await userEvent.setup().click(nextBtn as HTMLElement)
    await waitFor(() =>
      expect(document.querySelector('.ant-pagination-item-active')).toHaveAttribute('title', '2'),
    )
  })
})

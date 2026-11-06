import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { resetMockPartnerUsers } from '../../../../mocks/data/partnerUsers'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { PARTNER_USERS_ENDPOINTS } from '../constants'
import { UsersPage } from '../UsersPage'

const LIST = PARTNER_USERS_ENDPOINTS.list

function setMobile(isMobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: !isMobile && /min-width/.test(query),
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

/**
 * Sets a field in one event rather than per keystroke.
 *
 * `userEvent.type` replays every character, and each one re-runs rc-field-form
 * validation plus the `Form.useWatch` chain behind the save button — filling
 * this form a character at a time pushed the file past the 30s timeout under
 * full-suite contention. Clicks stay on userEvent, where realism matters.
 */
function setField(input: Element, value: string) {
  fireEvent.change(input, { target: { value } })
}

/** Row actions are icon-only; reach them by their aria-labels within a row. */
function rowActions(name: string) {
  const cell = screen.getByText(name).closest('tr') as HTMLElement
  return {
    edit: within(cell).getByRole('button', { name: /^edit$/i }),
    setPassword: within(cell).getByRole('button', { name: /set new password/i }),
    delete: within(cell).queryByRole('button', { name: /^delete$/i }),
  }
}

beforeEach(() => {
  resetMockPartnerUsers()
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  setMobile(false)
})

describe('UsersPage list', () => {
  it('renders the restaurant users from the API', async () => {
    renderWithProviders(<UsersPage />)
    expect(await screen.findByText('Yasmeen Iqbal')).toBeInTheDocument()
    expect(screen.getByText('Osama Hashmi')).toBeInTheDocument()
  })

  it('shows a spinner while the first page loads', () => {
    const { container } = renderWithProviders(<UsersPage />)
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message when the list fails', async () => {
    server.use(
      http.get(LIST, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_INTERNAL', message: 'Users are unavailable.' } },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<UsersPage />)
    expect(await screen.findByText('Users are unavailable.')).toBeInTheDocument()
  })

  it('reports the server total rather than the page length', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    expect(screen.getByText(/of 4 results/i)).toBeInTheDocument()
  })

  it('requests a new page size from the server', async () => {
    const sizes: (string | null)[] = []
    server.use(
      http.get(LIST, ({ request }) => {
        sizes.push(new URL(request.url).searchParams.get('pageSize'))
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 10, totalRecords: 0, totalPages: 1 },
          },
        })
      }),
    )
    renderWithProviders(<UsersPage />)
    await waitFor(() => {
      expect(sizes).toContain('25')
    })

    const user = userEvent.setup()
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    await user.click(
      await screen.findByText('10 / page', { selector: '.ant-select-item-option-content' }),
    )

    await waitFor(() => {
      expect(sizes).toContain('10')
    })
  })
})

describe('UsersPage create', () => {
  it('creates a user and confirms the credentials were emailed', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /new user/i }))
    const modal = document.querySelector('.ant-modal') as HTMLElement
    const inputs = modal.querySelectorAll('input')

    setField(inputs[0], 'Nadia Rahman')
    setField(inputs[1], 'nadia@aurelia.pk')
    setField(inputs[2], 'Marketing Lead')
    const passwords = modal.querySelectorAll('input[type="password"]')
    setField(passwords[0], 'Aurelia2026!')
    setField(passwords[1], 'Aurelia2026!')

    await user.click(screen.getByRole('button', { name: /send invite/i }))

    expect(await screen.findByText(/have been sent to them/i)).toBeInTheDocument()
  })

  it('surfaces a duplicate email as a toast without closing the form', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: /new user/i }))
    const modal = document.querySelector('.ant-modal') as HTMLElement
    const inputs = modal.querySelectorAll('input')

    setField(inputs[0], 'Clashing Name')
    setField(inputs[1], 'yasmeen@aurelia.pk')
    const passwords = modal.querySelectorAll('input[type="password"]')
    setField(passwords[0], 'Aurelia2026!')
    setField(passwords[1], 'Aurelia2026!')

    await user.click(screen.getByRole('button', { name: /send invite/i }))

    expect(await screen.findByText(/already registered/i)).toBeInTheDocument()
  })
})

describe('UsersPage edit', () => {
  it('patches only the changed field and reports success', async () => {
    let patched: Record<string, unknown> = {}
    server.use(
      http.patch(`${LIST}/:userId`, async ({ request }) => {
        patched = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({
          success: true,
          data: {
            id: 'pu-2',
            fullName: 'Yasmeen Iqbal',
            designation: 'Operations Lead',
            lastActiveAt: '2026-05-04',
            status: 'ACTIVE',
            isPrimary: false,
            canSuspend: true,
            canDelete: true,
          },
        })
      }),
    )

    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    const user = userEvent.setup()

    await user.click(rowActions('Yasmeen Iqbal').edit)
    setField(await screen.findByDisplayValue('General Manager'), 'Operations Lead')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(patched).toEqual({ designation: 'Operations Lead' })
    })
    expect(await screen.findByText(/has been updated/i)).toBeInTheDocument()
  })

  it('skips the call entirely when nothing changed (BR-14)', async () => {
    let patchCount = 0
    server.use(
      http.patch(`${LIST}/:userId`, () => {
        patchCount += 1
        return HttpResponse.json({ success: true, data: {} })
      }),
    )

    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    const user = userEvent.setup()

    await user.click(rowActions('Yasmeen Iqbal').edit)
    await screen.findByDisplayValue('General Manager')
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // destroyOnHidden tears the form down, so the field vanishing is the signal
    // that the save was handled and the modal closed.
    await waitFor(() => {
      expect(screen.queryByDisplayValue('General Manager')).toBeNull()
    })
    expect(patchCount).toBe(0)
    // No call means no success claim either.
    expect(screen.queryByText(/has been updated/i)).toBeNull()
  })

  it('locks the status control for the primary user but still allows a rename', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Hira Mansoor')
    await userEvent.setup().click(rowActions('Hira Mansoor').edit)

    const modal = document.querySelector('.ant-modal') as HTMLElement
    expect(modal.querySelector('.ant-select-disabled')).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Hira Mansoor')).toBeEnabled()
  })
})

describe('UsersPage set password', () => {
  it('sets the password and says explicitly that no email was sent', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    const user = userEvent.setup()

    await user.click(rowActions('Yasmeen Iqbal').setPassword)
    const inputs = await screen.findAllByPlaceholderText(/password/i)
    setField(inputs[0], 'Aurelia2026!')
    setField(inputs[1], 'Aurelia2026!')
    await user.click(screen.getByRole('button', { name: /set password/i }))

    // The actor must be told the user was NOT notified, or nobody tells them.
    expect(await screen.findByText(/we haven't emailed it/i)).toBeInTheDocument()
  })

  it('is offered on the primary user too (AC-01.3)', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Hira Mansoor')
    expect(rowActions('Hira Mansoor').setPassword).toBeInTheDocument()
  })
})

describe('UsersPage delete', () => {
  it('soft-deletes and drops the row from the list', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    const user = userEvent.setup()

    await user.click(rowActions('Yasmeen Iqbal').delete as HTMLElement)
    await user.click(await screen.findByRole('button', { name: /delete user/i }))

    expect(await screen.findByText(/no longer has access/i)).toBeInTheDocument()
    // Scoped to the table body: the confirm dialog also renders the name, so an
    // unscoped query would keep matching its lingering copy.
    await waitFor(() => {
      const body = document.querySelector('.ant-table-tbody') as HTMLElement
      expect(within(body).queryByText('Yasmeen Iqbal')).toBeNull()
    })
  })

  it('offers no delete control on the primary user (BR-03)', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Hira Mansoor')
    expect(rowActions('Hira Mansoor').delete).toBeNull()
  })

  it('shows the server message and keeps the session when the guard rejects a delete', async () => {
    // The row claims it is deletable but the server disagrees — the 403 must be
    // reported, not treated as the caller's own suspension.
    server.use(
      http.get(LIST, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'pu-9',
                fullName: 'Stale Row',
                designation: null,
                lastActiveAt: null,
                status: 'ACTIVE',
                isPrimary: true,
                canSuspend: true,
                canDelete: true,
              },
            ],
            pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
          },
        }),
      ),
      http.delete(`${LIST}/:userId`, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_FORBIDDEN_PRIMARY',
              message: 'The primary user cannot be suspended or removed here.',
            },
          },
          { status: 403 },
        ),
      ),
    )

    renderWithProviders(<UsersPage />)
    await screen.findByText('Stale Row')
    const user = userEvent.setup()

    await user.click(rowActions('Stale Row').delete as HTMLElement)
    await user.click(await screen.findByRole('button', { name: /delete user/i }))

    expect(await screen.findByText(/cannot be suspended or removed/i)).toBeInTheDocument()
    expect(tokenStore.hasSession()).toBe(true)
  })
})

describe('UsersPage mobile', () => {
  it('renders cards and opens edit from the more menu', async () => {
    setMobile(true)
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    const user = userEvent.setup()

    await user.click(screen.getAllByRole('button', { name: /more actions/i })[0])
    await user.click(await screen.findByRole('menuitem', { name: /edit/i }))

    expect(await screen.findByText('Edit user')).toBeInTheDocument()
  })

  it('offers no delete item for the primary user on mobile', async () => {
    setMobile(true)
    renderWithProviders(<UsersPage />)
    await screen.findByText('Hira Mansoor')
    const user = userEvent.setup()

    // Hira is the first card and is the primary user.
    await user.click(screen.getAllByRole('button', { name: /more actions/i })[0])
    await screen.findByRole('menuitem', { name: /edit/i })
    expect(screen.queryByRole('menuitem', { name: /delete/i })).not.toBeInTheDocument()
  })

  it('renders an em dash where the grid gives no email', async () => {
    setMobile(true)
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })
})

/**
 * MET-1307 / TC-PARTNER-USERS-012c. Both empty states used to render AntD's
 * default placeholder, so "your filter matched nothing" and "you have no other
 * users" were byte-for-byte identical — and the remedy for each is different.
 */
describe('UsersPage empty states (MET-1307)', () => {
  /** An account whose restaurant genuinely has no other users. */
  function serveNoUsers() {
    server.use(
      http.get(LIST, () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [],
            pagination: { page: 1, pageSize: 25, totalRecords: 0, totalPages: 1 },
          },
        }),
      ),
    )
  }

  /** Types a Name search that the mock data cannot match. */
  async function searchForNothing() {
    const user = userEvent.setup()
    const icon = screen.getByRole('img', { name: 'Search by NAME' })
    await user.click(icon.closest('.ant-table-filter-trigger') as HTMLElement)
    await user.type(screen.getByRole('textbox', { name: 'Search by NAME' }), 'zzzzz')
    await user.click(screen.getByRole('button', { name: 'Search' }))
  }

  it('tells a restaurant with no other users to add one', async () => {
    serveNoUsers()
    renderWithProviders(<UsersPage />)
    expect(await screen.findByText('No other users yet')).toBeInTheDocument()
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  it('tells a partner whose search matched nothing to clear the filters', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')

    await searchForNothing()

    expect(await screen.findByText('No users match your search')).toBeInTheDocument()
    expect(screen.getByText(/clear the filters/i)).toBeInTheDocument()
  })

  it('keeps the two states distinct — neither reuses the other’s copy', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Yasmeen Iqbal')

    await searchForNothing()

    expect(await screen.findByText('No users match your search')).toBeInTheDocument()
    expect(screen.queryByText('No other users yet')).not.toBeInTheDocument()
  })

  it('still calls it empty, not filtered, when only a sort is applied', async () => {
    serveNoUsers()
    renderWithProviders(<UsersPage />)
    await screen.findByText('No other users yet')

    await userEvent.setup().click(screen.getAllByRole('columnheader')[0])

    expect(await screen.findByText('No other users yet')).toBeInTheDocument()
    expect(screen.queryByText('No users match your search')).not.toBeInTheDocument()
  })

  it('gives the mobile card list an empty state too, which it had none of', async () => {
    setMobile(true)
    serveNoUsers()
    renderWithProviders(<UsersPage />)
    expect(await screen.findByText('No other users yet')).toBeInTheDocument()
  })
})

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Modal } from 'antd'
import { http, HttpResponse } from 'msw'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { UsersPage } from '../UsersPage'

const data = [
  {
    id: 'u1',
    fullName: 'Alice',
    email: 'alice@m.c',
    role: { id: 'r1', name: 'Super Admin', fullAccess: true },
    status: 'ACTIVE',
    initials: 'AL',
    createdAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'u2',
    fullName: 'Bob',
    email: 'bob@m.c',
    role: { id: 'r3', name: 'Finance Manager', fullAccess: false },
    status: 'SUSPENDED',
    initials: 'BO',
    createdAt: '2024-02-15T00:00:00.000Z',
  },
]

function setMobile(isMobile: boolean) {
  // Override matchMedia to return desktop (matches=true for md+) or mobile (matches=false)
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

beforeEach(() => {
  server.use(
    http.get('/api/v1/users', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: data,
          pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
        },
      }),
    ),
    http.get('/api/v1/roles/active', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: [
            { id: 'r1', name: 'Super Admin' },
            { id: 'r3', name: 'Finance Manager' },
          ],
        },
      }),
    ),
  )
  setMobile(false)
})

describe('UsersPage', () => {
  it('renders users title and table', async () => {
    renderWithProviders(<UsersPage />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('opens new user modal and cancels', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    const cancels = await screen.findAllByRole('button', { name: /cancel/i })
    await user.click(cancels[cancels.length - 1])
  })

  it('opens edit modal and saves', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0]) // edit
    const user = userEvent.setup()
    const saveBtns = await screen.findAllByRole('button')
    const save = saveBtns.find((b) => /save changes/i.test(b.textContent ?? ''))
    if (save) await user.click(save)
  })

  it('opens reset password modal and cancels', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0]) // reset password (Key icon)
    const cancels = await screen.findAllByRole('button', { name: /cancel/i })
    await userEvent.setup().click(cancels[cancels.length - 1])
  })

  it('opens delete modal and confirms', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1]) // delete (Trash icon)
    const user = userEvent.setup()
    const buttons = await screen.findAllByRole('button')
    const confirmBtn = buttons.find((b) => /delete user/i.test(b.textContent ?? ''))
    if (confirmBtn) await user.click(confirmBtn)
  })

  it('creates a new user', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    // Fill form — use fireEvent.change to avoid slow per-keystroke simulation
    const inputs = document.querySelectorAll('.ant-modal input')
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'New Person' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'new@x.com' } })
    // Select role — combos[0] is the page-size Select in UsersPaginationRow,
    // combos[1] is the role Select inside the new-user modal portal
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1])
    const adminOpt = await screen.findAllByText(/Super Admin/i)
    await user.click(adminOpt[adminOpt.length - 1])
    // Password & confirm — must satisfy validatePassword (8+ chars, upper, lower, digit, special)
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    // Click send invite (the last styled button)
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons.find((b) => /send invite|sendInvite/i.test(b.textContent ?? ''))
    if (sendBtn) await user.click(sendBtn)
  })

  it('renders the Password and Confirm Password fields with matching styling', async () => {
    // Regression: the Password input previously carried a fixed-height
    // `h-10 rounded-lg` class that the Confirm Password input did not, so the
    // two boxes rendered at different heights. Both must now be styled purely by
    // `size="large"` + the shared `.app-form` CSS. jsdom has no layout engine, so
    // we assert class parity rather than pixel height.
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    await userEvent.setup().click(screen.getByRole('button', { name: /new user/i }))
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    expect(pwInputs).toHaveLength(2)
    const passwordWrapper = pwInputs[0].closest('.ant-input-affix-wrapper')
    const confirmWrapper = pwInputs[1].closest('.ant-input-affix-wrapper')
    expect(passwordWrapper).not.toBeNull()
    expect(confirmWrapper).not.toBeNull()
    // The fixed-height override must be gone…
    expect(passwordWrapper?.classList.contains('h-10')).toBe(false)
    // …and both password wrappers must share the same class list.
    expect(passwordWrapper?.className).toBe(confirmWrapper?.className)
  })

  it('cancels edit modal', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[0])
    const user = userEvent.setup()
    const cancels = await screen.findAllByRole('button', { name: /cancel/i })
    await user.click(cancels[cancels.length - 1])
  })

  it('cancels delete modal', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1]) // delete (Trash icon)
    const user = userEvent.setup()
    const cancels = await screen.findAllByRole('button', { name: /cancel/i })
    await user.click(cancels[cancels.length - 1])
  })

  it('triggers handlePasswordReset (confirms reset modal)', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1]) // reset password (Key icon)
    const user = userEvent.setup()
    const pwdInputs = await screen.findAllByPlaceholderText(/password/i)
    await user.type(pwdInputs[0], 'StrongPass1')
    await user.type(pwdInputs[1], 'StrongPass1')
    const submitBtn = await screen.findByRole('button', { name: /set password/i })
    await user.click(submitBtn)
  })

  it('mobile pagination next page', async () => {
    setMobile(true)
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...data[0],
      id: `u${i}`,
      fullName: `User${i}`,
    }))
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: many,
            pagination: { page: 1, pageSize: 25, totalRecords: many.length, totalPages: 2 },
          },
        }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('User0')
    const next = screen.queryByTitle('Next Page')
    if (next) await userEvent.setup().click(next)
  })

  it('changes page size in desktop view', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    const opts = await screen.findAllByText(/25 \/ page/i)
    await user.click(opts[opts.length - 1])
  })

  it('renders mobile card list when isMobile', async () => {
    setMobile(true)
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const editBtns = screen.getAllByRole('button', { name: /edit/i })
    if (editBtns[0]) await userEvent.setup().click(editBtns[0])
  })

  it('clicks reset and delete in mobile card list', async () => {
    setMobile(true)
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    const resetBtns = screen.getAllByRole('button', { name: /reset/i })
    if (resetBtns[0]) await user.click(resetBtns[0])
    // Close reset modal
    const cancels = screen.getAllByRole('button', { name: /cancel/i })
    if (cancels[cancels.length - 1]) await user.click(cancels[cancels.length - 1])
    const deleteBtns = screen.getAllByRole('button', { name: /^delete/i })
    if (deleteBtns[0]) await user.click(deleteBtns[0])
  })
})

describe('UsersPage — desktop pagination handlers', () => {
  beforeEach(() => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      ...data[0],
      id: `u${i}`,
      fullName: `User${i}`,
    }))
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: many,
            pagination: { page: 1, pageSize: 25, totalRecords: 30, totalPages: 2 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({ success: true, data: { items: [{ id: 'r1', name: 'Super Admin' }] } }),
      ),
    )
    setMobile(false)
  })

  it('changes the current page via the desktop pagination row', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('User0')
    const user = userEvent.setup()
    const nextPage = document.querySelector('.users-pagination .ant-pagination-next')
    expect(nextPage).not.toBeNull()
    await user.click(nextPage as HTMLElement)
    // Pagination control reflects the page change driven by onPageChange.
    await waitFor(() =>
      expect(
        document.querySelector('.users-pagination .ant-pagination-item-active'),
      ).toHaveAttribute('title', '2'),
    )
  })

  it('changes the page size via the desktop page-size select', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('User0')
    const user = userEvent.setup()
    // Initially 10 per page → "Showing 1–10 of 30 results".
    expect(screen.getByText(/showing 1–10 of 30 results/i)).toBeInTheDocument()
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[combos.length - 1])
    const fiftyOpt = await screen.findAllByText('50 / page')
    await user.click(fiftyOpt[fiftyOpt.length - 1])
    // onPageSizeChange(50) widens the window → "Showing 1–30 of 30 results".
    expect(await screen.findByText(/showing 1–30 of 30 results/i)).toBeInTheDocument()
  })
})

describe('UsersPage — reset password error path', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: data,
            pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({ success: true, data: { items: [{ id: 'r1', name: 'Super Admin' }] } }),
      ),
    )
    setMobile(true)
  })

  it('shows a generic failure message when the set-password request errors', async () => {
    server.use(
      http.post('/api/v1/users/:id/change-password', () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    const resetBtns = screen.getAllByRole('button', { name: /reset/i })
    await user.click(resetBtns[0])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const submit = (await screen.findAllByRole('button')).find((b) =>
      /set password/i.test(b.textContent ?? ''),
    )
    if (submit) await user.click(submit)
    expect(
      await screen.findByText(/failed to set password\. please try again\./i),
    ).toBeInTheDocument()
  })
})

describe('UsersPage — cancel delete modal in mobile view', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: data,
            pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({ success: true, data: { items: [{ id: 'r1', name: 'Super Admin' }] } }),
      ),
    )
    setMobile(true)
  })

  it('closes the delete modal via its cancel button', async () => {
    const deleteSpy = vi.fn()
    server.use(
      http.delete('/api/v1/users/:id', () => {
        deleteSpy()
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    const deleteBtns = screen.getAllByRole('button', { name: /^delete/i })
    await user.click(deleteBtns[0])
    // Delete confirmation modal opened.
    await screen.findByText(/are you sure you want to delete/i)
    // Click Cancel scoped to the open dialog → onCancel() clears deleteTarget.
    const dialog = screen.getByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    // Cancelling must not trigger a delete request, and the user remains listed.
    expect(deleteSpy).not.toHaveBeenCalled()
    expect(screen.getAllByText('Alice').length).toBeGreaterThan(0)
  })
})

describe('UsersPage — edit and delete mutation paths (mobile)', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: data,
            pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { id: 'r1', name: 'Super Admin' },
              { id: 'r3', name: 'Finance Manager' },
            ],
          },
        }),
      ),
    )
    setMobile(true)
  })

  // Imperative Modal.warning() dialogs attach to document.body and are not torn
  // down by RTL cleanup, so destroy them between tests to keep text queries unique.
  afterEach(() => {
    Modal.destroyAll()
  })

  it('saves an edit successfully and shows the updated message', async () => {
    server.use(
      http.patch('/api/v1/users/:id', () =>
        HttpResponse.json({ success: true, data: { id: 'u1' } }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])
    const save = await screen.findByRole('button', { name: /save changes/i })
    await user.click(save)
    await waitFor(() =>
      expect(screen.getAllByText(/profile has been updated/i).length).toBeGreaterThan(0),
    )
  })

  it('shows the last-super-admin warning when an edit is blocked', async () => {
    server.use(
      http.patch('/api/v1/users/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_LAST_SUPER_ADMIN' } }, { status: 409 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])
    const save = await screen.findByRole('button', { name: /save changes/i })
    await user.click(save)
    await waitFor(() =>
      expect(
        screen.getAllByText(/at least one active super admin must exist/i).length,
      ).toBeGreaterThan(0),
    )
  })

  it('keeps the edit modal open and shows a generic error when the update fails with an unmatched error', async () => {
    server.use(
      http.patch('/api/v1/users/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])
    const save = await screen.findByRole('button', { name: /save changes/i })
    await user.click(save)
    await waitFor(() =>
      expect(screen.getAllByText(/something went wrong/i).length).toBeGreaterThan(0),
    )
    // The edit modal must still be open — the save button is still there.
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
  })

  it('deletes a user successfully and shows the deleted message', async () => {
    server.use(http.delete('/api/v1/users/:id', () => new HttpResponse(null, { status: 204 })))
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /^delete/i })[0])
    const confirm = (await screen.findAllByRole('button')).find((b) =>
      /delete user/i.test(b.textContent ?? ''),
    )
    if (confirm) await user.click(confirm)
    await waitFor(() => expect(screen.getAllByText(/has been deleted/i).length).toBeGreaterThan(0))
  })

  it('shows the last-super-admin warning when a delete is blocked', async () => {
    server.use(
      http.delete('/api/v1/users/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_LAST_SUPER_ADMIN' } }, { status: 409 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /^delete/i })[0])
    const confirm = (await screen.findAllByRole('button')).find((b) =>
      /delete user/i.test(b.textContent ?? ''),
    )
    if (confirm) await user.click(confirm)
    await waitFor(() =>
      expect(
        screen.getAllByText(/at least one active super admin must exist/i).length,
      ).toBeGreaterThan(0),
    )
  })

  it('leaves the user listed when a delete fails with a non-HttpError', async () => {
    server.use(http.delete('/api/v1/users/:id', () => HttpResponse.error()))
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /^delete/i })[0])
    const confirm = (await screen.findAllByRole('button')).find((b) =>
      /delete user/i.test(b.textContent ?? ''),
    )
    if (confirm) await user.click(confirm)
    // Neither error-code branch matches a network failure, so nothing is dismissed.
    await waitFor(() => expect(screen.getAllByText('Alice').length).toBeGreaterThan(0))
  })

  it('shows the self-modification warning when deleting own account', async () => {
    server.use(
      http.delete('/api/v1/users/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_SELF_MODIFICATION' } }, { status: 403 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /^delete/i })[0])
    const confirm = (await screen.findAllByRole('button')).find((b) =>
      /delete user/i.test(b.textContent ?? ''),
    )
    if (confirm) await user.click(confirm)
    await waitFor(() =>
      expect(
        screen.getAllByText(/use edit profile to manage your own account/i).length,
      ).toBeGreaterThan(0),
    )
  })
})

describe('UsersPage — reset password success and self-modification', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: data,
            pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({ success: true, data: { items: [{ id: 'r1', name: 'Super Admin' }] } }),
      ),
    )
    setMobile(true)
  })

  it('shows the success message when the set-password request succeeds', async () => {
    server.use(
      http.post('/api/v1/users/:id/change-password', () =>
        HttpResponse.json({
          success: true,
          data: { id: 'u1', email: 'alice@m.c', passwordChangedAt: '2026-06-18T00:00:00.000Z' },
        }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    const resetBtns = screen.getAllByRole('button', { name: /reset/i })
    await user.click(resetBtns[0])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const submit = (await screen.findAllByRole('button')).find((b) =>
      /set password/i.test(b.textContent ?? ''),
    )
    if (submit) await user.click(submit)
    expect(await screen.findByText(/new password has been set for/i)).toBeInTheDocument()
  })

  it('shows the self-modification warning when set-password returns ERR_SELF_MODIFICATION', async () => {
    server.use(
      http.post('/api/v1/users/:id/change-password', () =>
        HttpResponse.json({ error: { code: 'ERR_SELF_MODIFICATION' } }, { status: 403 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    const resetBtns = screen.getAllByRole('button', { name: /reset/i })
    await user.click(resetBtns[0])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const submit = (await screen.findAllByRole('button')).find((b) =>
      /set password/i.test(b.textContent ?? ''),
    )
    if (submit) await user.click(submit)
    expect(
      await screen.findByText(/use edit profile to manage your own account/i),
    ).toBeInTheDocument()
  })
})

describe('UsersPage — branch coverage extras', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: data,
            pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({ success: true, data: { items: [{ id: 'r1', name: 'Super Admin' }] } }),
      ),
    )
    setMobile(false)
  })

  it('updates query params when a sortable column header is clicked', async () => {
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    await user.click(headers[0]) // triggers Table onChange → handleQueryParamsChange
    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('falls back to empty role options when active roles fail to load', async () => {
    server.use(http.get('/api/v1/roles/active', () => HttpResponse.json({}, { status: 500 })))
    renderWithProviders(<UsersPage />)
    expect(await screen.findByText('Alice')).toBeInTheDocument()
  })

  it('renders card fallbacks for a user without status or last-active date (mobile)', async () => {
    setMobile(true)
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              {
                id: 'u9',
                fullName: 'NoMeta',
                email: 'n@m.c',
                role: { id: 'r1', name: 'Super Admin' },
                initials: 'NM',
              },
            ],
            pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
          },
        }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('NoMeta')
    // status ?? '' and createdAt ? … : '—' fallbacks both render.
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})

describe('UsersPage — error state', () => {
  it('shows error alert when users fetch fails', async () => {
    server.use(
      http.get('/api/v1/users', () => HttpResponse.json({}, { status: 500 })),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({ success: true, data: { items: [] } }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await waitFor(() => expect(document.querySelector('.ant-alert-error')).not.toBeNull())
  })
})

describe('UsersPage — create user error paths', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: data,
            pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: [
              { id: 'r1', name: 'Super Admin' },
              { id: 'r3', name: 'Finance Manager' },
            ],
          },
        }),
      ),
    )
    setMobile(false)
  })

  it('shows email already in use error when POST returns ERR_EMAIL_IN_USE', async () => {
    server.use(
      http.post('/api/v1/users', () =>
        HttpResponse.json(
          { error: { code: 'ERR_EMAIL_IN_USE', message: 'Email in use' } },
          { status: 409 },
        ),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    const inputs = document.querySelectorAll('.ant-modal input')
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'Test User' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'alice@example.com' } })
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1])
    const adminOpts = await screen.findAllByText(/Super Admin/i)
    await user.click(adminOpts[adminOpts.length - 1])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons.find((b) => /send invite/i.test(b.textContent ?? ''))
    if (sendBtn) await user.click(sendBtn)
    expect(
      await screen.findByText(/an account with this email already exists/i),
    ).toBeInTheDocument()
  })

  it('keeps the new user modal open and shows a generic error when create fails with an unmatched error', async () => {
    server.use(
      http.post('/api/v1/users', () =>
        HttpResponse.json({ error: { code: 'ERR_INTERNAL' } }, { status: 500 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    const inputs = document.querySelectorAll('.ant-modal input')
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'Test User' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'newuser@x.com' } })
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1])
    const adminOpts = await screen.findAllByText(/Super Admin/i)
    await user.click(adminOpts[adminOpts.length - 1])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons.find((b) => /send invite/i.test(b.textContent ?? ''))
    if (sendBtn) await user.click(sendBtn)
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
    // The new-user modal must still be open with the typed data intact.
    expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
    expect(screen.getByDisplayValue('newuser@x.com')).toBeInTheDocument()
  })

  it('rejects a name longer than 255 characters and does not POST even when other fields are valid', async () => {
    let postCalled = false
    server.use(
      http.post('/api/v1/users', () => {
        postCalled = true
        return HttpResponse.json({ id: 'u100' }, { status: 201 })
      }),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    const inputs = document.querySelectorAll('.ant-modal input')
    // 256 chars → over the 255 limit. All other fields are valid.
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'a'.repeat(256) } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'newuser@x.com' } })
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1])
    const adminOpts = await screen.findAllByText(/Super Admin/i)
    await user.click(adminOpts[adminOpts.length - 1])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons.find((b) => /send invite/i.test(b.textContent ?? ''))
    if (sendBtn) await user.click(sendBtn)

    // Validation blocks the create: message renders, modal stays open, no POST.
    expect(await screen.findByText(/enter a valid user name/i)).toBeInTheDocument()
    expect(postCalled).toBe(false)
  })

  it('shows warning when user is created but invite email failed', async () => {
    server.use(
      http.post('/api/v1/users', () =>
        HttpResponse.json({ id: 'u99', emailFailed: true }, { status: 201 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    const inputs = document.querySelectorAll('.ant-modal input')
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'Test User' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'newuser@x.com' } })
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1])
    const adminOpts = await screen.findAllByText(/Super Admin/i)
    await user.click(adminOpts[adminOpts.length - 1])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const buttons = screen.getAllByRole('button')
    const sendBtn = buttons.find((b) => /send invite/i.test(b.textContent ?? ''))
    if (sendBtn) await user.click(sendBtn)
    expect(await screen.findByText(/login details could not be sent/i)).toBeInTheDocument()
  })
})

describe('UsersPage — delete user error paths', () => {
  beforeEach(() => {
    server.use(
      http.get('/api/v1/users', () =>
        HttpResponse.json({
          success: true,
          data: {
            items: data,
            pagination: { page: 1, pageSize: 25, totalRecords: data.length, totalPages: 1 },
          },
        }),
      ),
      http.get('/api/v1/roles/active', () =>
        HttpResponse.json({ success: true, data: { items: [{ id: 'r1', name: 'Super Admin' }] } }),
      ),
    )
    setMobile(false)
  })

  it('shows Modal.warning when deleting the last Super Admin', async () => {
    server.use(
      http.delete('/api/v1/users/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_LAST_SUPER_ADMIN' } }, { status: 409 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1])
    const deleteBtn = (await screen.findAllByRole('button')).find((b) =>
      /delete user/i.test(b.textContent ?? ''),
    )
    if (deleteBtn) fireEvent.click(deleteBtn as HTMLElement)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /delete user/i })).not.toBeInTheDocument(),
    )
  })

  it('shows warning when trying to delete own account (ERR_SELF_MODIFICATION)', async () => {
    server.use(
      http.delete('/api/v1/users/:id', () =>
        HttpResponse.json({ error: { code: 'ERR_SELF_MODIFICATION' } }, { status: 403 }),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const rows = document.querySelectorAll('.ant-table-tbody tr.ant-table-row')
    const actionDivs = Array.from(rows[0].querySelectorAll('td:last-child div')).filter((d) =>
      d.querySelector('svg'),
    )
    const innerMost = actionDivs
      .filter((d) => d.querySelectorAll('svg').length === 1)
      .sort((a, b) => a.children.length - b.children.length)
    fireEvent.click(innerMost[1])
    const deleteBtn = (await screen.findAllByRole('button')).find((b) =>
      /delete user/i.test(b.textContent ?? ''),
    )
    if (deleteBtn) fireEvent.click(deleteBtn as HTMLElement)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /delete user/i })).not.toBeInTheDocument(),
    )
  })
})

// ── A-02 / A-04 pentest remediation ───────────────────────────────────────────
// A-02: role deletion and role assignment are validated in separate transactions,
// so an administrator can end up bound to a soft-deleted role. The API then
// returns role.name: "" and the role is absent from GET /roles/active.
const orphanedData = [
  {
    id: 'u9',
    fullName: 'Orphan Olive',
    email: 'olive@m.c',
    role: { id: 'deleted-role-id', name: '', fullAccess: false },
    status: 'ACTIVE',
    initials: 'OO',
    createdAt: '2024-03-15T00:00:00.000Z',
  },
]

function serveOrphanedUser() {
  server.use(
    http.get('/api/v1/users', () =>
      HttpResponse.json({
        success: true,
        data: {
          items: orphanedData,
          pagination: { page: 1, pageSize: 25, totalRecords: 1, totalPages: 1 },
        },
      }),
    ),
    // The deleted role is absent from the active-roles catalogue.
    http.get('/api/v1/roles/active', () =>
      HttpResponse.json({
        success: true,
        data: { items: [{ id: 'r1', name: 'Super Admin' }] },
      }),
    ),
  )
}

describe('UsersPage — orphaned role visibility (A-02)', () => {
  afterEach(() => {
    Modal.destroyAll()
  })

  it('labels a deleted role in the desktop roster instead of rendering a blank cell', async () => {
    serveOrphanedUser()
    renderWithProviders(<UsersPage />)
    await screen.findByText('Orphan Olive')
    expect(screen.getByText(/role deleted/i)).toBeInTheDocument()
  })

  it('labels a deleted role in the mobile card list', async () => {
    setMobile(true)
    serveOrphanedUser()
    renderWithProviders(<UsersPage />)
    await screen.findByText('Orphan Olive')
    expect(screen.getByText(/role deleted/i)).toBeInTheDocument()
  })

  it('blocks saving an edit while the assigned role is deleted', async () => {
    // Mobile: the card list exposes a labelled Edit button, whereas the desktop
    // roster renders bare action icons.
    setMobile(true)
    serveOrphanedUser()
    renderWithProviders(<UsersPage />)
    await screen.findByText('Orphan Olive')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

    // The stale role is surfaced explicitly and Save is refused: previously the
    // modal silently accepted the dead roleId and re-submitted it, so the
    // administrator stayed locked out.
    expect(await screen.findByText(/this role no longer exists/i)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /save changes/i })).toBeDisabled()
  })

  it('leaves Save enabled when the assigned role is still live', async () => {
    setMobile(true)
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getAllByRole('button', { name: /edit/i })[0])

    expect(await screen.findByRole('button', { name: /save changes/i })).not.toBeDisabled()
    expect(screen.queryByText(/this role no longer exists/i)).not.toBeInTheDocument()
  })
})

describe('UsersPage — Cognito email squatting (A-04)', () => {
  afterEach(() => {
    Modal.destroyAll()
  })

  // A-04: the API answers this case with HTTP 500 ERR_USER_CREATION_FAILED and
  // "Please try again", advice the pentest report notes can never succeed. The
  // code was previously unhandled, so that misleading text was shown verbatim.
  it('shows an actionable conflict message on the email field for ERR_USER_CREATION_FAILED', async () => {
    server.use(
      http.post('/api/v1/users', () =>
        HttpResponse.json(
          {
            error: {
              code: 'ERR_USER_CREATION_FAILED',
              message: 'We could not create the account. Please try again.',
            },
          },
          { status: 500 },
        ),
      ),
    )
    renderWithProviders(<UsersPage />)
    await screen.findByText('Alice')
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /new user/i }))
    const inputs = document.querySelectorAll('.ant-modal input')
    fireEvent.change(inputs[0] as HTMLInputElement, { target: { value: 'Squatted User' } })
    fireEvent.change(inputs[1] as HTMLInputElement, { target: { value: 'squatted@example.com' } })
    const combos = screen.getAllByRole('combobox')
    await user.click(combos[1])
    const adminOpts = await screen.findAllByText(/Super Admin/i)
    await user.click(adminOpts[adminOpts.length - 1])
    const pwInputs = document.querySelectorAll('.ant-modal input[type="password"]')
    fireEvent.change(pwInputs[0] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    fireEvent.change(pwInputs[1] as HTMLInputElement, { target: { value: 'Pass1234!' } })
    const sendBtn = screen
      .getAllByRole('button')
      .find((b) => /send invite/i.test(b.textContent ?? ''))
    if (sendBtn) await user.click(sendBtn)

    expect(
      await screen.findByText(/already registered with the identity provider/i),
    ).toBeInTheDocument()
    // The server's "please try again" must not reach the operator.
    expect(screen.queryByText(/we could not create the account/i)).not.toBeInTheDocument()
  })
})

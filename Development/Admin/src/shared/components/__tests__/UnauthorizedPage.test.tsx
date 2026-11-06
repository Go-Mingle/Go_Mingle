import { describe, it, expect, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import { renderWithProviders, makeStore } from '../../../test-utils/renderWithProviders'
import { UnauthorizedPage } from '../UnauthorizedPage'

const fullAccessAuth = {
  user: {
    id: 'u1',
    name: 'Admin',
    email: 'a@b.c',
    role: 'Super Admin',
    permissions: [],
    fullAccess: true,
    initials: 'AD',
  },
  isAuthenticated: true,
}

describe('UnauthorizedPage', () => {
  it('renders the not-authorized message', () => {
    renderWithProviders(<UnauthorizedPage />, { store: makeStore({ auth: fullAccessAuth }) })
    expect(screen.getByText(/not authorized to view this page/i)).toBeInTheDocument()
  })

  it('shows a link to an available page when the user can access one', () => {
    renderWithProviders(<UnauthorizedPage />, { store: makeStore({ auth: fullAccessAuth }) })
    expect(screen.getByRole('button', { name: /available page/i })).toBeInTheDocument()
  })

  // A-02 — a 500 from /auth/me leaves the user with no permissions, which used to
  // be indistinguishable from a genuine denial. Say it is a server fault instead.
  it('reports a server fault rather than a denial when permissions could not be loaded', () => {
    const store = makeStore({
      auth: { ...fullAccessAuth, permissionsUnavailable: true },
    })
    renderWithProviders(<UnauthorizedPage />, { store })
    expect(screen.getByText(/permissions could not be loaded/i)).toBeInTheDocument()
    expect(screen.getByText(/not a permissions problem/i)).toBeInTheDocument()
    expect(screen.queryByText(/not authorized to view this page/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
  })

  it('reloads the page when Retry is pressed', async () => {
    const reload = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { ...original, reload },
    })
    try {
      const store = makeStore({ auth: { ...fullAccessAuth, permissionsUnavailable: true } })
      renderWithProviders(<UnauthorizedPage />, { store })
      await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }))
      expect(reload).toHaveBeenCalledTimes(1)
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: original,
      })
    }
  })

  it('keeps the standard denial message when permissions loaded fine', () => {
    const store = makeStore({
      auth: { ...fullAccessAuth, permissionsUnavailable: false },
    })
    renderWithProviders(<UnauthorizedPage />, { store })
    expect(screen.getByText(/not authorized to view this page/i)).toBeInTheDocument()
    expect(screen.queryByText(/permissions could not be loaded/i)).not.toBeInTheDocument()
  })

  it('hides the navigation button when the user has no accessible module', () => {
    const noAccess = {
      user: { ...fullAccessAuth.user, fullAccess: false, permissions: [] },
      isAuthenticated: true,
    }
    renderWithProviders(<UnauthorizedPage />, { store: makeStore({ auth: noAccess }) })
    expect(screen.queryByRole('button', { name: /available page/i })).not.toBeInTheDocument()
  })
})

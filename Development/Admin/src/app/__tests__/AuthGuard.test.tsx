import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../mocks/server'
import { makeStore, renderWithProviders } from '../../test-utils/renderWithProviders'
import { AuthGuard } from '../AuthGuard'

const authedState = {
  auth: {
    user: {
      id: 'u1',
      name: 'User',
      email: 'a@b.c',
      role: 'Old Role',
      permissions: [],
      fullAccess: false,
      initials: 'US',
    },
    isAuthenticated: true,
    accessTokenExpiry: Date.now() + 60 * 60 * 1000,
    refreshTokenExpiry: Date.now() + 7 * 24 * 60 * 60 * 1000,
  },
}

describe('AuthGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves permissions from auth/me and syncs them + fullName into the store', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@b.c',
          fullName: 'Muhammad Adeel',
          role: { id: 'r3', name: 'Finance Manager', permissions: ['FINANCES'], fullAccess: false },
          status: 'ACTIVE',
          createdAt: '21-05-2026 18:30',
        }),
      ),
    )
    const store = makeStore(authedState)

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    expect(screen.getByText('PROTECTED')).toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(60_000)

    await waitFor(() => {
      const user = store.getState().auth.user
      expect(user?.role).toBe('Finance Manager')
      expect(user?.permissions).toEqual(['FINANCES'])
      expect(user?.fullAccess).toBe(false)
      // Display name always mirrors the profile's fullName.
      expect(user?.name).toBe('Muhammad Adeel')
    })
  })

  it('degrades gracefully when auth/me omits permissions — stays logged in with no permissions', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@b.c',
          fullName: 'Muhammad Adeel',
          role: { id: 'r3', name: 'Finance Manager' },
          status: 'ACTIVE',
          createdAt: '21-05-2026 18:30',
        }),
      ),
    )
    const store = makeStore(authedState)

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    await vi.advanceTimersByTimeAsync(60_000)

    await waitFor(() => {
      const state = store.getState().auth
      expect(state.isAuthenticated).toBe(true)
      // Role name still syncs from auth/me; permissions degrade to none.
      expect(state.user?.role).toBe('Finance Manager')
      expect(state.user?.permissions).toEqual([])
      expect(state.user?.fullAccess).toBe(false)
    })
  })

  it('expires the session once the refresh token itself is past its life', () => {
    const store = makeStore({
      auth: {
        ...authedState.auth,
        accessTokenExpiry: Date.now() - 60_000,
        refreshTokenExpiry: Date.now() - 1_000,
      },
    })

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    expect(store.getState().auth.isAuthenticated).toBe(false)
    expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument()
  })

  it('keeps rendering on a merely expired access token — the 401 is what triggers renewal (BR-02)', () => {
    // Past the locally-stored access expiry, well inside the refresh window.
    const staleAccessExpiry = Date.now() - 60_000
    const store = makeStore({
      auth: { ...authedState.auth, accessTokenExpiry: staleAccessExpiry },
    })

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    // No local "renewal" fakes the session forward, and nothing signs the user
    // out either: httpClient renews against Cognito when a request 401s.
    expect(store.getState().auth.isAuthenticated).toBe(true)
    expect(store.getState().auth.accessTokenExpiry).toBe(staleAccessExpiry)
    expect(screen.getByText('PROTECTED')).toBeInTheDocument()
  })

  // A-02 — /auth/me returns HTTP 500 when the caller's role has been soft-deleted.
  // That used to be swallowed by an unconditional catch, so the operator kept stale
  // permissions with no indication anything was wrong.
  it('records a permissions outage when auth/me returns 500, without ending the session', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({ error: { code: 'SERVER_ERROR' } }, { status: 500 }),
      ),
    )
    const store = makeStore(authedState)

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    await vi.advanceTimersByTimeAsync(60_000)

    await waitFor(() => {
      expect(store.getState().auth.permissionsUnavailable).toBe(true)
    })
    // A server fault is not a session problem — the user stays signed in.
    expect(store.getState().auth.isAuthenticated).toBe(true)
  })

  it('clears a recorded permissions outage once auth/me succeeds again', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({
          id: 'u1',
          email: 'a@b.c',
          fullName: 'Muhammad Adeel',
          role: { id: 'r3', name: 'Finance Manager', permissions: ['FINANCES'], fullAccess: false },
          status: 'ACTIVE',
          createdAt: '21-05-2026 18:30',
        }),
      ),
    )
    const store = makeStore({
      auth: { ...authedState.auth, permissionsUnavailable: true },
    })

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    await vi.advanceTimersByTimeAsync(60_000)

    await waitFor(() => {
      expect(store.getState().auth.permissionsUnavailable).toBe(false)
    })
  })

  it('does not record a permissions outage when the session itself is rejected', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({ error: { code: 'ERR_UNAUTHORIZED' } }, { status: 401 }),
      ),
    )
    const store = makeStore(authedState)

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    await vi.advanceTimersByTimeAsync(60_000)

    await waitFor(() => {
      expect(store.getState().auth.isAuthenticated).toBe(false)
    })
    expect(store.getState().auth.permissionsUnavailable).toBe(false)
  })

  it('expires the session when auth/me returns 401', async () => {
    server.use(
      http.get('/api/v1/auth/me', () =>
        HttpResponse.json({ error: { code: 'ERR_UNAUTHORIZED' } }, { status: 401 }),
      ),
    )
    const store = makeStore(authedState)

    renderWithProviders(
      <AuthGuard>
        <div>PROTECTED</div>
      </AuthGuard>,
      { store },
    )

    await vi.advanceTimersByTimeAsync(60_000)

    await waitFor(() => {
      expect(store.getState().auth.isAuthenticated).toBe(false)
    })
  })
})

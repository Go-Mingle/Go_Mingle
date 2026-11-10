import { describe, it, expect, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { makeStore, renderWithProviders } from '../../test-utils/renderWithProviders'
import { tokenStore } from '../../shared/auth/tokenStore'
import { AuthGuard } from '../AuthGuard'

function authState(isAuthenticated: boolean) {
  return {
    auth: {
      user: isAuthenticated
        ? { id: 'u1', name: 'Hira', email: 'partner@gomingle.com', role: 'x', initials: 'HM' }
        : null,
      isAuthenticated,
      accessTokenExpiry: null,
      refreshTokenExpiry: null,
    },
  }
}

function renderGuard(isAuthenticated: boolean) {
  return renderWithProviders(
    <Routes>
      <Route
        path="/overview"
        element={
          <AuthGuard>
            <div>PROTECTED</div>
          </AuthGuard>
        }
      />
      <Route path="/login" element={<div>LOGIN</div>} />
    </Routes>,
    { route: '/overview', store: makeStore(authState(isAuthenticated)) },
  )
}

beforeEach(() => {
  tokenStore.clear()
})

describe('AuthGuard', () => {
  it('renders the protected screen when the flag and the token agree', () => {
    tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })

    renderGuard(true)

    expect(screen.getByText('PROTECTED')).toBeInTheDocument()
  })

  it('redirects to login when there is no session at all', () => {
    renderGuard(false)

    expect(screen.getByText('LOGIN')).toBeInTheDocument()
    expect(screen.queryByText('PROTECTED')).not.toBeInTheDocument()
  })

  it('redirects when the redux flag is stale but the token is gone', () => {
    // The HTTP layer clears the token on a 401/403; without this check a
    // signed-out user would linger on the page until the next request failed.
    renderGuard(true)

    expect(screen.getByText('LOGIN')).toBeInTheDocument()
  })

  it('redirects when a token lingers but the store says signed out', () => {
    tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })

    renderGuard(false)

    expect(screen.getByText('LOGIN')).toBeInTheDocument()
  })
})

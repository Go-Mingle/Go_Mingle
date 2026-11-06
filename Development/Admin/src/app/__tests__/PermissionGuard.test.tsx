import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, makeStore } from '../../test-utils/renderWithProviders'
import { PermissionGuard } from '../PermissionGuard'

function makeAuth(overrides: { permissions?: string[]; fullAccess?: boolean } = {}) {
  return {
    user: {
      id: 'u1',
      name: 'User',
      email: 'a@b.c',
      role: 'Scoped',
      permissions: overrides.permissions ?? [],
      fullAccess: overrides.fullAccess ?? false,
      initials: 'US',
    },
    isAuthenticated: true,
  }
}

const Protected = () => <div>PROTECTED CONTENT</div>

describe('PermissionGuard', () => {
  it('renders children when the user has the module permission', () => {
    renderWithProviders(
      <PermissionGuard module="FINANCES">
        <Protected />
      </PermissionGuard>,
      { store: makeStore({ auth: makeAuth({ permissions: ['FINANCES'] }) }) },
    )
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument()
  })

  it('renders children for a full-access user regardless of permissions', () => {
    renderWithProviders(
      <PermissionGuard module="LOYALTY_CONFIGURATION">
        <Protected />
      </PermissionGuard>,
      { store: makeStore({ auth: makeAuth({ fullAccess: true }) }) },
    )
    expect(screen.getByText('PROTECTED CONTENT')).toBeInTheDocument()
  })

  it('renders the unauthorized page when the user lacks the module permission', () => {
    renderWithProviders(
      <PermissionGuard module="FINANCES">
        <Protected />
      </PermissionGuard>,
      { store: makeStore({ auth: makeAuth({ permissions: ['AMENITIES'] }) }) },
    )
    expect(screen.queryByText('PROTECTED CONTENT')).not.toBeInTheDocument()
    expect(screen.getByText(/not authorized to view this page/i)).toBeInTheDocument()
  })

  it('redirects to /login when there is no authenticated user', () => {
    renderWithProviders(
      <Routes>
        <Route
          path="/"
          element={
            <PermissionGuard module="FINANCES">
              <Protected />
            </PermissionGuard>
          }
        />
        <Route path="/login" element={<div>LOGIN PAGE</div>} />
      </Routes>,
      { store: makeStore({ auth: { user: null, isAuthenticated: false } }) },
    )
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })
})

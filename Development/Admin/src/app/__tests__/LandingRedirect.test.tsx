import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Routes, Route } from 'react-router-dom'
import { renderWithProviders, makeStore } from '../../test-utils/renderWithProviders'
import { LandingRedirect } from '../LandingRedirect'

function renderLanding(auth: Record<string, unknown>) {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<LandingRedirect />} />
      <Route path="/restaurants" element={<div>RESTAURANTS PAGE</div>} />
      <Route path="/finances" element={<div>FINANCES PAGE</div>} />
      <Route path="/login" element={<div>LOGIN PAGE</div>} />
    </Routes>,
    { store: makeStore({ auth }), route: '/' },
  )
}

describe('LandingRedirect', () => {
  it('redirects a full-access user to the first module', () => {
    renderLanding({
      user: {
        id: 'u',
        name: 'A',
        email: 'a@b.c',
        role: 'Super Admin',
        permissions: [],
        fullAccess: true,
        initials: 'A',
      },
      isAuthenticated: true,
    })
    expect(screen.getByText('RESTAURANTS PAGE')).toBeInTheDocument()
  })

  it('redirects a scoped user to their first accessible module', () => {
    renderLanding({
      user: {
        id: 'u',
        name: 'A',
        email: 'a@b.c',
        role: 'Finance',
        permissions: ['FINANCES'],
        fullAccess: false,
        initials: 'A',
      },
      isAuthenticated: true,
    })
    expect(screen.getByText('FINANCES PAGE')).toBeInTheDocument()
  })

  it('shows the unauthorized page when the user can access nothing', () => {
    renderLanding({
      user: {
        id: 'u',
        name: 'A',
        email: 'a@b.c',
        role: 'None',
        permissions: [],
        fullAccess: false,
        initials: 'A',
      },
      isAuthenticated: true,
    })
    expect(screen.getByText(/not authorized to view this page/i)).toBeInTheDocument()
  })

  it('redirects to /login when there is no user', () => {
    renderLanding({ user: null, isAuthenticated: false })
    expect(screen.getByText('LOGIN PAGE')).toBeInTheDocument()
  })
})

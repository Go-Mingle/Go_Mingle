import { describe, it, expect } from 'vitest'
import { screen, within, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '../../../mocks/server'
import { renderWithProviders, makeStore } from '../../../test-utils/renderWithProviders'
import { Sidebar } from '../Sidebar'

function approvalsCount(totalRecords: number) {
  return http.get('/api/v1/admin/approvals', () =>
    HttpResponse.json({
      success: true,
      data: { items: [], pagination: { page: 1, pageSize: 1, totalRecords, totalPages: 1 } },
    }),
  )
}

function authWith(permissions: string[], fullAccess = false) {
  return {
    user: {
      id: 'u1',
      name: 'User',
      email: 'a@b.c',
      role: 'Scoped',
      permissions,
      fullAccess,
      initials: 'US',
    },
    isAuthenticated: true,
  }
}

describe('Sidebar RBAC filtering', () => {
  it('shows every nav item for a full-access user', () => {
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith([], true) }) })
    expect(screen.getByRole('link', { name: /restaurants/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /finances/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /amenities/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /roles & access/i })).toBeInTheDocument()
  })

  it('shows only items the scoped user has permission for', () => {
    renderWithProviders(<Sidebar />, {
      store: makeStore({ auth: authWith(['FINANCES', 'AMENITIES']) }),
    })
    expect(screen.getByRole('link', { name: /finances/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /amenities/i })).toBeInTheDocument()
    // Not granted → hidden.
    expect(screen.queryByRole('link', { name: /restaurants/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /roles & access/i })).not.toBeInTheDocument()
  })

  it('shows interests and interest-topics when INTEREST_TOPICS is granted', () => {
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith(['INTEREST_TOPICS']) }) })
    expect(screen.getByRole('link', { name: /interests/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /topics/i })).toBeInTheDocument()
  })

  it('shows interests and interest-topics for a full-access user', () => {
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith([], true) }) })
    expect(screen.getByRole('link', { name: /interests/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /topics/i })).toBeInTheDocument()
  })

  it('hides interests and interest-topics when only CATEGORIES is granted (no INTEREST_TOPICS)', () => {
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith(['CATEGORIES']) }) })
    // Categories itself is still visible…
    expect(screen.getByRole('link', { name: /categories/i })).toBeInTheDocument()
    // …but the interests/topics items are now gated by INTEREST_TOPICS.
    expect(screen.queryByRole('link', { name: /interests/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /topics/i })).not.toBeInTheDocument()
  })

  it('hides interests and interest-topics when the user lacks INTEREST_TOPICS', () => {
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith(['AMENITIES']) }) })
    expect(screen.queryByRole('link', { name: /interests/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /topics/i })).not.toBeInTheDocument()
  })

  it('hides the entire MANAGE section when no manage module is granted', () => {
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith(['AMENITIES']) }) })
    // Only configure items visible; no manage links.
    expect(screen.queryByRole('link', { name: /restaurants/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /minglers/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /amenities/i })).toBeInTheDocument()
  })
})

describe('Sidebar approval-queue badge', () => {
  it('shows the live pending-approvals count from the API', async () => {
    server.use(approvalsCount(3))
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith([], true) }) })
    const link = await screen.findByRole('link', { name: /approval queue/i })
    expect(await within(link).findByText('3')).toBeInTheDocument()
  })

  it('renders no badge when there are no pending approvals', async () => {
    server.use(approvalsCount(0))
    renderWithProviders(<Sidebar />, { store: makeStore({ auth: authWith([], true) }) })
    const link = await screen.findByRole('link', { name: /approval queue/i })
    await waitFor(() => expect(within(link).queryByText('0')).toBeNull())
  })
})

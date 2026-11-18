import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, within } from '@testing-library/react'
import { server } from '../../../../mocks/server'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { TeamDirectory } from '../TeamDirectory'

const URL = '*/api/v1/partner/users'

const colleagues = [
  { id: 'pu-2', fullName: 'Sara Khan', designation: 'Floor Manager', email: 'sara@kolachi.pk', role: 'MEMBER', isPrimary: false },
  { id: 'pu-1', fullName: 'Rahim Ahmed', designation: 'Owner', email: 'rahim@kolachi.pk', role: 'OWNER', isPrimary: true },
  { id: 'pu-3', fullName: 'Ali Raza', designation: null, email: 'ali@kolachi.pk', role: 'MEMBER', isPrimary: false },
]
const page = (items: unknown[]) => ({
  success: true,
  data: { items, pagination: { page: 1, pageSize: 100, totalRecords: items.length, totalPages: 1 }, canManage: false },
})

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('TeamDirectory (team members)', () => {
  it('lists everyone with role, designation and email, owners first', async () => {
    server.use(http.get(URL, () => HttpResponse.json(page(colleagues))))
    renderWithProviders(<TeamDirectory />)
    expect(await screen.findByText('Rahim Ahmed')).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows).toHaveLength(3)
    expect(within(rows[0]).getByText('Rahim Ahmed')).toBeInTheDocument()
    expect(within(rows[0]).getAllByText('Owner').length).toBeGreaterThan(0)
    expect(within(rows[1]).getByText('Team member')).toBeInTheDocument()
    expect(within(rows[1]).getByText('Floor Manager')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'sara@kolachi.pk' })).toHaveAttribute('href', 'mailto:sara@kolachi.pk')
    expect(within(rows[2]).getByText('—')).toBeInTheDocument()
  })

  it('offers no way to add or change anyone', async () => {
    server.use(http.get(URL, () => HttpResponse.json(page(colleagues))))
    renderWithProviders(<TeamDirectory />)
    await screen.findByText('Rahim Ahmed')
    expect(screen.queryByRole('button', { name: /new user|edit|delete|set password/i })).not.toBeInTheDocument()
    expect(screen.getByText(/Only an owner can add people or change their access/)).toBeInTheDocument()
  })

  it('says so when nobody else is on the team', async () => {
    server.use(http.get(URL, () => HttpResponse.json(page([]))))
    renderWithProviders(<TeamDirectory />)
    expect(await screen.findByText('Nobody else here yet')).toBeInTheDocument()
  })

  it('shows an error when the team cannot be loaded', async () => {
    server.use(http.get(URL, () => HttpResponse.json({ error: { message: 'Down for maintenance.' } }, { status: 400 })))
    renderWithProviders(<TeamDirectory />)
    expect(await screen.findByRole('alert', {}, { timeout: 8000 })).toBeInTheDocument()
  })
})

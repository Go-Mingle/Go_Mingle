import { http, HttpResponse } from 'msw'
import type { Role } from '../../app/modules/roles-access/types'
import { mockRoles, mockUsers } from '../data/index'

const BASE = '/api/v1/roles'

interface ChangeLogEntry {
  id: string
  action: 'ROLE_CREATED' | 'ROLE_UPDATED' | 'ROLE_DELETED'
  module: 'ROLES_AND_ACCESS'
  actorUserId: string
  resourceId: string
  resourceName: string
  timestamp: string
}

export const changeLogEntries: ChangeLogEntry[] = []

/** How many admin users hold the role — counted live, never stored. */
function assignedCount(roleId: string): number {
  return mockUsers.filter((u) => u.roleId === roleId).length
}

function withCount<T extends { id: string }>(role: T): T & { usersAssigned: number } {
  return { ...role, usersAssigned: assignedCount(role.id) }
}

export const rolesHandlers = [
  /** GET /api/v1/roles — paginated, filterable list of non-deleted roles */
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? '1')
    const pageSize = Number(url.searchParams.get('pageSize') ?? '25')
    const search = url.searchParams.get('search')?.toLowerCase() ?? ''
    const sortBy = url.searchParams.get('sortBy') === 'usersAssigned' ? 'usersAssigned' : 'name'
    const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'

    let active = mockRoles.filter((r) => r.deleted_at == null).map(withCount)
    if (search) active = active.filter((r) => r.name.toLowerCase().includes(search))

    active = [...active].sort((a, b) => {
      const cmp =
        sortBy === 'usersAssigned'
          ? (a.usersAssigned ?? 0) - (b.usersAssigned ?? 0)
          : a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      return sortDir === 'asc' ? cmp : -cmp
    })

    const totalItems = active.length
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
    const items = active.slice((page - 1) * pageSize, page * pageSize)

    return HttpResponse.json({
      items,
      pagination: { page, pageSize, totalItems, totalPages },
    })
  }),

  /** GET /api/v1/roles/active — minimal {id, name} pairs for non-deleted roles */
  http.get(`${BASE}/active`, () => {
    const items = mockRoles
      .filter((r) => r.deleted_at == null)
      .map((r) => ({ id: r.id, name: r.name }))
    return HttpResponse.json({ items })
  }),

  /** GET /api/v1/roles/permission-keys — sectioned permission catalogue.
   * Mirrors the real J2 endpoint: static response wrapped in the
   * { success, data } envelope, canonical display order (Configure → Manage). */
  http.get(`${BASE}/permission-keys`, () => {
    return HttpResponse.json({
      success: true,
      data: {
        sections: [
          {
            section: 'Configure',
            permissions: [
              { key: 'ROLES_AND_ACCESS', label: 'Roles and Access' },
              { key: 'USERS', label: 'User Management' },
              { key: 'CATEGORIES', label: 'Category Management' },
              { key: 'INTEREST_TOPICS', label: 'Interest Topics' },
              { key: 'LOYALTY_CONFIGURATION', label: 'Loyalty Configuration' },
              { key: 'AMENITIES', label: 'Amenities' },
              { key: 'PREFERENCE_QUESTIONS', label: 'Preference Questions' },
              { key: 'TIMER_SETTINGS', label: 'Timer Settings' },
            ],
          },
          {
            section: 'Manage',
            permissions: [
              { key: 'RESTAURANT_APPROVALS', label: 'Approvals Queue' },
              { key: 'MANAGE_RESTAURANTS', label: 'Manage Restaurants' },
              { key: 'MANAGE_MINGLERS', label: 'Manage Minglers' },
              { key: 'BOOKINGS', label: 'Bookings' },
              { key: 'REVIEWS', label: 'Reviews' },
              { key: 'FINANCES', label: 'Finances' },
              { key: 'CHANGE_LOG', label: 'Change Log' },
            ],
          },
        ],
      },
    })
  }),

  /** GET /api/v1/roles/:id — single role incl. permissions[] + fullAccess.
   * Wrapped in the { success, data } envelope (httpClient unwraps to the Role).
   * Backs the RBAC resolution chain (auth/me → roles/{id}) and useRoleQuery.
   * Declared after /active and /permission-keys so those specific routes win. */
  http.get(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const role = mockRoles.find((r) => r.id === id && r.deleted_at == null)
    if (!role) return HttpResponse.json({ error: { code: 'ERR_ROLE_NOT_FOUND' } }, { status: 404 })
    return HttpResponse.json({ success: true, data: withCount(role) })
  }),

  /** POST /api/v1/roles — create a new role */
  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    const created: Role = {
      id: `r${Date.now()}`,
      name: (body.name as string) ?? '',
      fullAccess: (body.fullAccess as boolean) ?? false,
      permissions: (body.permissions as string[]) ?? [],
      usersAssigned: 0,
      deleted_at: null,
    }
    mockRoles.push(created as (typeof mockRoles)[number])
    changeLogEntries.push({
      id: String(Date.now()),
      action: 'ROLE_CREATED',
      module: 'ROLES_AND_ACCESS',
      actorUserId: 'mock-admin',
      resourceId: created.id,
      resourceName: created.name,
      timestamp: new Date().toISOString(),
    })
    return HttpResponse.json(created, { status: 201 })
  }),

  /** PATCH /api/v1/roles/:id — partial update */
  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    const id = params.id as string
    const body = (await request.json()) as Partial<Role>
    const idx = mockRoles.findIndex((r) => r.id === id)
    if (idx < 0)
      return HttpResponse.json({ error: { code: 'ERR_ROLE_NOT_FOUND' } }, { status: 404 })
    const { usersAssigned: _ignored, ...changes } = body
    void _ignored
    mockRoles[idx] = { ...mockRoles[idx], ...changes } as (typeof mockRoles)[number]
    // Users carry a copy of their role's name and access level.
    for (const user of mockUsers) {
      if (user.roleId === id) {
        user.role = { id, name: mockRoles[idx].name, fullAccess: mockRoles[idx].fullAccess }
      }
    }
    changeLogEntries.push({
      id: String(Date.now()),
      action: 'ROLE_UPDATED',
      module: 'ROLES_AND_ACCESS',
      actorUserId: 'mock-admin',
      resourceId: mockRoles[idx].id,
      resourceName: mockRoles[idx].name,
      timestamp: new Date().toISOString(),
    })
    return HttpResponse.json(withCount(mockRoles[idx]))
  }),

  /** DELETE /api/v1/roles/:id — soft-delete, returns 204 No Content */
  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const idx = mockRoles.findIndex((r) => r.id === id)
    if (idx < 0)
      return HttpResponse.json({ error: { code: 'ERR_ROLE_NOT_FOUND' } }, { status: 404 })
    if (assignedCount(id) > 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_ROLE_HAS_ASSIGNED_USERS',
            message: 'Reassign the users who hold this role before deleting it.',
          },
        },
        { status: 409 },
      )
    }
    ;(mockRoles[idx] as Role & { deleted_at: string | null }).deleted_at = new Date().toISOString()
    changeLogEntries.push({
      id: String(Date.now()),
      action: 'ROLE_DELETED',
      module: 'ROLES_AND_ACCESS',
      actorUserId: 'mock-admin',
      resourceId: mockRoles[idx].id,
      resourceName: mockRoles[idx].name,
      timestamp: new Date().toISOString(),
    })
    return new HttpResponse(null, { status: 204 })
  }),
]

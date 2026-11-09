import { http, HttpResponse } from 'msw'
import { mockRoles, mockUsers } from '../data/index'

const BASE = '/api/v1/users'

const DEFAULT_CURRENT_USER_ID = 'u1'
let currentUserId = DEFAULT_CURRENT_USER_ID

/**
 * The signed-in admin, whose own row the Users screen hides and protects from
 * self-modification. The GoMingle API sets it per request from the session.
 */
export function setMockCurrentUserId(id: string | null) {
  currentUserId = id ?? DEFAULT_CURRENT_USER_ID
}

/** The role as the users API returns it, resolved from the roles store. */
function resolveRole(roleId: string) {
  const role = mockRoles.find((r) => r.id === roleId && r.deleted_at == null)
  return role ? { id: role.id, name: role.name, fullAccess: role.fullAccess } : null
}

function nextUserId(): string {
  const max = mockUsers.reduce((n, u) => {
    const m = /^u(\d+)$/.exec(u.id)
    return m ? Math.max(n, Number(m[1])) : n
  }, 0)
  return `u${max + 1}`
}

type MockUser = (typeof mockUsers)[number]

function envelope<T>(data: T) {
  return { success: true as const, data }
}

function errorEnvelope(code: string, message: string, status: number) {
  return HttpResponse.json({ success: false, error: { code, message, details: {} } }, { status })
}

function toUserResponse(u: MockUser) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    role: { id: u.role.id, name: u.role.name, fullAccess: u.role.fullAccess },
    status: u.status as 'ACTIVE' | 'SUSPENDED',
    createdAt: u.createdAt,
  }
}

function isOnlyActiveSuperAdmin(targetId: string): boolean {
  const activeSuperAdmins = mockUsers.filter(
    (u) => u.role.fullAccess === true && u.status === 'ACTIVE',
  )
  return activeSuperAdmins.length === 1 && activeSuperAdmins[0].id === targetId
}

export const usersHandlers = [
  // GET /api/v1/users — paginated list, excludes current user
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 25)
    const sortOrder = url.searchParams.get('sortOrder') ?? 'asc'
    const q = url.searchParams.get('q') ?? ''
    const statuses = url.searchParams.get('statuses')?.split(',').filter(Boolean) ?? []

    let items = [...mockUsers].filter((u) => u.id !== currentUserId)
    if (q) {
      items = items.filter(
        (u) =>
          u.fullName.toLowerCase().includes(q.toLowerCase()) ||
          u.email.toLowerCase().includes(q.toLowerCase()),
      )
    }
    if (statuses.length) {
      items = items.filter((u) => statuses.includes(u.status))
    }
    items.sort((a, b) =>
      sortOrder === 'asc'
        ? a.fullName.localeCompare(b.fullName)
        : b.fullName.localeCompare(a.fullName),
    )

    const totalRecords = items.length
    const totalPages = Math.ceil(totalRecords / pageSize) || 1
    const paged = items.slice((page - 1) * pageSize, page * pageSize)

    return HttpResponse.json(
      envelope({
        items: paged.map(toUserResponse),
        pagination: { page, pageSize, totalRecords, totalPages },
      }),
    )
  }),

  // GET /api/v1/users/:id
  http.get(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    if (id === currentUserId) {
      return errorEnvelope('ERR_SELF_MODIFICATION', 'Cannot operate on your own account.', 403)
    }
    const user = mockUsers.find((u) => u.id === id)
    if (!user) {
      return errorEnvelope('ERR_USER_NOT_FOUND', 'User not found.', 404)
    }
    return HttpResponse.json(envelope(toUserResponse(user)))
  }),

  // POST /api/v1/users — create user
  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as {
      fullName: string
      email: string
      roleId: string
      status?: string
      password: string
      confirmPassword: string
    }
    const emailExists = mockUsers.some((u) => u.email.toLowerCase() === body.email.toLowerCase())
    if (emailExists) {
      return errorEnvelope('ERR_EMAIL_IN_USE', 'Email already in use.', 409)
    }
    const role = resolveRole(body.roleId)
    if (!role) {
      return errorEnvelope('ERR_ROLE_NOT_FOUND', 'Choose an existing role.', 422)
    }
    const newUser: MockUser = {
      id: nextUserId(),
      fullName: body.fullName,
      username: body.email.split('@')[0],
      email: body.email,
      role,
      roleId: body.roleId,
      status: (body.status as 'ACTIVE' | 'SUSPENDED') ?? 'ACTIVE',
      lastActive: new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
      initials: body.fullName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .slice(0, 2),
    }
    mockUsers.push(newUser)
    return HttpResponse.json(envelope(toUserResponse(newUser)), { status: 201 })
  }),

  // PATCH /api/v1/users/:id — update user
  http.patch(`${BASE}/:id`, async ({ request, params }) => {
    const id = params.id as string
    if (id === currentUserId) {
      return errorEnvelope('ERR_SELF_MODIFICATION', 'Cannot operate on your own account.', 403)
    }
    const idx = mockUsers.findIndex((u) => u.id === id)
    if (idx < 0) {
      return errorEnvelope('ERR_USER_NOT_FOUND', 'User not found.', 404)
    }
    if (isOnlyActiveSuperAdmin(id)) {
      return errorEnvelope(
        'ERR_LAST_SUPER_ADMIN',
        'Cannot modify the last active super admin.',
        409,
      )
    }
    const body = (await request.json()) as Partial<{
      fullName: string
      roleId: string
      status: 'ACTIVE' | 'SUSPENDED'
    }>
    const existing = mockUsers[idx]
    if (body.roleId !== undefined) {
      const role = resolveRole(body.roleId)
      if (!role) {
        return errorEnvelope('ERR_ROLE_NOT_FOUND', 'Choose an existing role.', 422)
      }
      existing.roleId = role.id
      existing.role = role
    }
    if (body.fullName !== undefined) existing.fullName = body.fullName
    if (body.status !== undefined) existing.status = body.status
    return HttpResponse.json(envelope(toUserResponse(existing)))
  }),

  // DELETE /api/v1/users/:id — 204 No Content
  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    if (id === currentUserId) {
      return errorEnvelope('ERR_SELF_MODIFICATION', 'Cannot operate on your own account.', 403)
    }
    if (isOnlyActiveSuperAdmin(id)) {
      return errorEnvelope(
        'ERR_LAST_SUPER_ADMIN',
        'Cannot delete the last active super admin.',
        409,
      )
    }
    const idx = mockUsers.findIndex((u) => u.id === id)
    if (idx >= 0) mockUsers.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),

  // POST /api/v1/users/:id/change-password
  http.post(`${BASE}/:id/change-password`, ({ params }) => {
    const id = params.id as string
    const user = mockUsers.find((u) => u.id === id)
    if (!user) {
      return errorEnvelope('ERR_USER_NOT_FOUND', 'User not found.', 404)
    }
    return HttpResponse.json(
      envelope({
        id: user.id,
        email: user.email,
        passwordChangedAt: new Date().toISOString(),
      }),
    )
  }),
]

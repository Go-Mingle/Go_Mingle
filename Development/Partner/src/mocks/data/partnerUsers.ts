import { HttpResponse } from 'msw'
import type {
  PartnerUserListItem,
  PartnerUserStatus,
  PartnerUsersPage,
} from '../../app/modules/users/types'

/**
 * J3 Users Management fixtures.
 *
 * The signed-in partner is deliberately absent from this set — the API never
 * returns the caller's own row (BR-02) — so there is no self-row for the UI to
 * handle and none to mock. Emails are restaurant-generic, not GoMingle
 * addresses: sub-users are restaurant staff.
 */

interface MockPartnerUser extends PartnerUserListItem {
  email: string
  deleted: boolean
}

function seed(): MockPartnerUser[] {
  return [
    {
      id: 'pu-1',
      fullName: 'Hira Mansoor',
      email: 'hira@aurelia.pk',
      designation: 'Owner',
      lastActiveAt: '2026-07-28',
      status: 'ACTIVE',
      // The primary user can be renamed but not suspended or deleted (BR-03).
      isPrimary: true,
      canSuspend: false,
      canDelete: false,
      deleted: false,
    },
    {
      id: 'pu-2',
      fullName: 'Yasmeen Iqbal',
      email: 'yasmeen@aurelia.pk',
      designation: 'General Manager',
      lastActiveAt: '2026-05-04',
      status: 'ACTIVE',
      isPrimary: false,
      canSuspend: true,
      canDelete: true,
      deleted: false,
    },
    {
      id: 'pu-3',
      fullName: 'Osama Hashmi',
      email: 'osama@aurelia.pk',
      designation: 'Floor Supervisor',
      lastActiveAt: null,
      status: 'ACTIVE',
      isPrimary: false,
      canSuspend: true,
      canDelete: true,
      deleted: false,
    },
    {
      id: 'pu-4',
      fullName: 'Laiba Naseer',
      email: 'laiba@aurelia.pk',
      designation: null,
      lastActiveAt: '2026-06-11',
      status: 'SUSPENDED',
      isPrimary: false,
      canSuspend: true,
      canDelete: true,
      deleted: false,
    },
  ]
}

export let mockPartnerUsers: MockPartnerUser[] = seed()

/** Tests mutate this store, so each file can start from a known set. */
export function resetMockPartnerUsers(): void {
  mockPartnerUsers = seed()
}

/** Grid rows carry neither the email nor the soft-delete flag. */
function toListItem(user: MockPartnerUser): PartnerUserListItem {
  return {
    id: user.id,
    fullName: user.fullName,
    designation: user.designation,
    lastActiveAt: user.lastActiveAt,
    status: user.status,
    isPrimary: user.isPrimary,
    canSuspend: user.canSuspend,
    canDelete: user.canDelete,
  }
}

const SORTERS: Record<string, (a: MockPartnerUser, b: MockPartnerUser) => number> = {
  name: (a, b) => a.fullName.localeCompare(b.fullName),
  designation: (a, b) => (a.designation ?? '').localeCompare(b.designation ?? ''),
  lastActive: (a, b) => (a.lastActiveAt ?? '').localeCompare(b.lastActiveAt ?? ''),
  status: (a, b) => a.status.localeCompare(b.status),
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export interface ListQuery {
  page?: string | null
  pageSize?: string | null
  sortBy?: string | null
  sortOrder?: string | null
  search?: string | null
  searchField?: string | null
  status?: string[]
  lastActiveFrom?: string | null
  lastActiveTo?: string | null
}

function matchesSearch(user: MockPartnerUser, search: string, field?: string | null): boolean {
  const needle = search.toLowerCase()
  const name = user.fullName.toLowerCase()
  const designation = (user.designation ?? '').toLowerCase()
  if (field === 'name') return name.includes(needle)
  if (field === 'designation') return designation.includes(needle)
  // Omitting the field searches both, which a single search box implies.
  return name.includes(needle) || designation.includes(needle)
}

/**
 * Mirrors the backend's forgiving behaviour: a bad sort, page, search or status
 * silently falls back to the default grid rather than 400ing. The date bounds
 * are the one exception — those really do 400.
 */
export function listPartnerUsers(query: ListQuery): Response {
  const { lastActiveFrom, lastActiveTo } = query

  const badDate =
    (lastActiveFrom && !DATE_ONLY.test(lastActiveFrom)) ||
    (lastActiveTo && !DATE_ONLY.test(lastActiveTo))
  const inverted = lastActiveFrom && lastActiveTo && lastActiveFrom > lastActiveTo
  if (badDate || inverted) {
    return errorResponse('ERR_VALIDATION', 'Invalid last-active date range.', 400)
  }

  let rows = mockPartnerUsers.filter((user) => !user.deleted)

  if (query.search?.trim()) {
    rows = rows.filter((user) => matchesSearch(user, query.search!.trim(), query.searchField))
  }
  if (query.status?.length) {
    const wanted = new Set(query.status)
    rows = rows.filter((user) => wanted.has(user.status))
  }
  if (lastActiveFrom)
    rows = rows.filter((u) => !!u.lastActiveAt && u.lastActiveAt >= lastActiveFrom)
  if (lastActiveTo) rows = rows.filter((u) => !!u.lastActiveAt && u.lastActiveAt <= lastActiveTo)

  const sorter = SORTERS[query.sortBy ?? '']
  if (sorter) {
    rows = [...rows].sort(sorter)
    if (query.sortOrder === 'desc') rows.reverse()
  }

  const pageSize = clampPageSize(query.pageSize)
  const totalRecords = rows.length
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
  const page = clampPage(query.page, totalPages)
  const start = (page - 1) * pageSize

  const body: PartnerUsersPage = {
    items: rows.slice(start, start + pageSize).map(toListItem),
    pagination: { page, pageSize, totalRecords, totalPages },
  }
  return HttpResponse.json({ success: true, data: body })
}

function clampPageSize(raw: string | null | undefined): number {
  const parsed = Number(raw)
  return [10, 25, 50, 100].includes(parsed) ? parsed : 25
}

function clampPage(raw: string | null | undefined, totalPages: number): number {
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  return Math.min(parsed, totalPages)
}

export function errorResponse(code: string, message: string, status: number): Response {
  return HttpResponse.json({ success: false, error: { code, message, details: null } }, { status })
}

export function findLiveUser(id: string): MockPartnerUser | undefined {
  return mockPartnerUsers.find((user) => user.id === id && !user.deleted)
}

export function createMockPartnerUser(body: Record<string, unknown>): Response {
  const fullName = String(body.fullName ?? '').trim()
  const email = String(body.email ?? '')
    .trim()
    .toLowerCase()
  const password = String(body.password ?? '')
  const confirmPassword = String(body.confirmPassword ?? '')

  // Rejected outright rather than ignored — the restaurant comes from the token
  // and there is no role concept at all.
  if ('role' in body || 'isPrimary' in body || 'restaurantId' in body) {
    return errorResponse('ERR_VALIDATION', 'Unexpected field.', 422)
  }
  if (!fullName) return errorResponse('ERR_VALIDATION', 'Name is required.', 422)
  if (!email) return errorResponse('ERR_VALIDATION', 'Email is required.', 422)
  if (!password || password !== confirmPassword) {
    return errorResponse('ERR_VALIDATION', 'Passwords do not match.', 422)
  }

  const existing = mockPartnerUsers.find((user) => user.email.toLowerCase() === email)
  if (existing && !existing.deleted) {
    return errorResponse('ERR_DUPLICATE_EMAIL', 'This email address is already registered.', 409)
  }

  const status = (body.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE') as PartnerUserStatus
  const designation = typeof body.designation === 'string' ? body.designation.trim() || null : null

  // Re-using a soft-deleted email revives that record instead of duplicating.
  if (existing?.deleted) {
    Object.assign(existing, {
      fullName,
      designation,
      status,
      deleted: false,
      lastActiveAt: null,
    })
    return HttpResponse.json(
      {
        success: true,
        data: { ...toListItem(existing), email: existing.email, reactivated: true },
      },
      { status: 201 },
    )
  }

  const created: MockPartnerUser = {
    id: `pu-${mockPartnerUsers.length + 1}`,
    fullName,
    email,
    designation,
    lastActiveAt: null,
    status,
    isPrimary: false,
    canSuspend: true,
    canDelete: true,
    deleted: false,
  }
  mockPartnerUsers.push(created)
  return HttpResponse.json(
    { success: true, data: { ...toListItem(created), email: created.email } },
    { status: 201 },
  )
}

export function updateMockPartnerUser(id: string, body: Record<string, unknown>): Response {
  if ('role' in body || 'email' in body) {
    return errorResponse('ERR_VALIDATION', 'That field cannot be changed.', 422)
  }

  const user = findLiveUser(id)
  if (!user) return errorResponse('ERR_NOT_FOUND', 'User not found.', 404)

  if (body.status === 'SUSPENDED' && !user.canSuspend) {
    return errorResponse(
      'ERR_FORBIDDEN_PRIMARY',
      'The primary user cannot be suspended or removed here.',
      403,
    )
  }

  if (typeof body.fullName === 'string') user.fullName = body.fullName.trim()
  // Omitting the key leaves it alone; '' clears it.
  if (typeof body.designation === 'string') user.designation = body.designation.trim() || null
  if (body.status === 'ACTIVE' || body.status === 'SUSPENDED') user.status = body.status

  return HttpResponse.json({ success: true, data: { ...toListItem(user), email: user.email } })
}

export function deleteMockPartnerUser(id: string): Response {
  const user = findLiveUser(id)
  if (!user) return errorResponse('ERR_NOT_FOUND', 'User not found.', 404)
  if (!user.canDelete) {
    return errorResponse(
      'ERR_FORBIDDEN_PRIMARY',
      'The primary user cannot be suspended or removed here.',
      403,
    )
  }
  // Soft delete — the record is retained (BR-10).
  user.deleted = true
  return HttpResponse.json({ success: true, data: { deleted: true } })
}

export function setMockPartnerUserPassword(id: string, body: Record<string, unknown>): Response {
  const user = findLiveUser(id)
  if (!user) return errorResponse('ERR_NOT_FOUND', 'User not found.', 404)

  const password = String(body.password ?? '')
  if (!password || password !== String(body.confirmPassword ?? '')) {
    return errorResponse('ERR_VALIDATION', 'Passwords do not match.', 422)
  }
  // Silent by design — no email is sent (BR-07).
  return HttpResponse.json({ success: true, data: { passwordSet: true } })
}

import { describe, it, expect, afterEach } from 'vitest'
import { mockRestaurants, mockUsers, mockInterestTopics } from '../data/index'
import { setMockCurrentUserId } from '../handlers/users'
import { __resetInviteesMock } from '../handlers/interest-tables'

/**
 * Data created in one admin module must show up, correctly, in the others:
 * roles in the user forms, users in the role counts, restaurant tables and menu
 * options in the interest-table forms, uploaded amenity icons everywhere.
 */

async function call<T = Record<string, unknown>>(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  const res = await fetch(new URL(path, window.location.origin), {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  return { status: res.status, json: (text ? JSON.parse(text) : null) as T }
}

type Envelope<T> = { success: boolean; data: T; error?: { code: string } }
type RoleBody = { id: string; name: string; usersAssigned: number; fullAccess: boolean }
type UserBody = { id: string; role: { id: string; name: string; fullAccess: boolean } }

afterEach(() => {
  setMockCurrentUserId(null)
  __resetInviteesMock()
})

describe('roles and users', () => {
  it('a new user carries the real role, and the role counts them', async () => {
    const role = (await call<RoleBody>('POST', '/api/v1/roles', {
      name: 'Night Manager',
      fullAccess: false,
      permissions: ['BOOKINGS'],
    })).json
    const active = await call<{ items: { id: string; name: string }[] }>('GET', '/api/v1/roles/active')
    expect(active.json.items).toContainEqual({ id: role.id, name: 'Night Manager' })

    const created = await call<Envelope<UserBody>>('POST', '/api/v1/users', {
      fullName: 'Zara Ali',
      email: 'zara@gomingle.com',
      roleId: role.id,
      password: 'Secret@123',
      confirmPassword: 'Secret@123',
    })
    expect(created.status).toBe(201)
    expect(created.json.data.role).toEqual({ id: role.id, name: 'Night Manager', fullAccess: false })

    const detail = await call<Envelope<RoleBody>>('GET', `/api/v1/roles/${role.id}`)
    expect(detail.json.data.usersAssigned).toBe(1)
    const list = await call<{ items: RoleBody[] }>('GET', '/api/v1/roles?page=1&pageSize=50')
    expect(list.json.items.find((r) => r.id === role.id)?.usersAssigned).toBe(1)

    // Renaming the role renames it on its users.
    await call('PATCH', `/api/v1/roles/${role.id}`, { name: 'Night Lead', usersAssigned: 99 })
    const user = await call<Envelope<UserBody>>('GET', `/api/v1/users/${created.json.data.id}`)
    expect(user.json.data.role.name).toBe('Night Lead')
    expect((await call<Envelope<RoleBody>>('GET', `/api/v1/roles/${role.id}`)).json.data.usersAssigned).toBe(1)

    // A role still held cannot be deleted.
    const blocked = await call<Envelope<null>>('DELETE', `/api/v1/roles/${role.id}`)
    expect(blocked.status).toBe(409)
    expect(blocked.json.error?.code).toBe('ERR_ROLE_HAS_ASSIGNED_USERS')
  })

  it('changing a user role stores the role object, and an unknown role is refused', async () => {
    const id = mockUsers.find((u) => u.roleId === 'r2' && u.id !== 'u1')!.id
    const moved = await call<Envelope<UserBody>>('PATCH', `/api/v1/users/${id}`, { roleId: 'r3' })
    expect(moved.json.data.role).toEqual({ id: 'r3', name: 'Finance Manager', fullAccess: false })

    const bad = await call<Envelope<null>>('PATCH', `/api/v1/users/${id}`, { roleId: 'nope' })
    expect(bad.status).toBe(422)
    const badCreate = await call<Envelope<null>>('POST', '/api/v1/users', {
      fullName: 'No Role',
      email: 'norole@gomingle.com',
      roleId: 'nope',
      password: 'Secret@123',
      confirmPassword: 'Secret@123',
    })
    expect(badCreate.status).toBe(422)
  })

  it('hides and protects whoever is signed in', async () => {
    setMockCurrentUserId('u2')
    const list = await call<Envelope<{ items: { id: string }[] }>>('GET', '/api/v1/users?page=1&pageSize=50')
    const ids = list.json.data.items.map((u) => u.id)
    expect(ids).not.toContain('u2')
    expect(ids).toContain('u1')
    expect((await call('GET', '/api/v1/users/u2')).status).toBe(403)
  })
})

describe('interest tables created by the admin', () => {
  it('use the restaurant, topic, table and menu options picked in the form', async () => {
    const restaurant = mockRestaurants[0]
    const topic = mockInterestTopics[0]
    const table = restaurant.tables[0]
    const combo = restaurant.combos[0]
    const res = await call<Envelope<{
      id: string
      restaurant: { name: string }
      topic: { id: string; name: string } | null
      assignedTable: { id: string; name: string } | null
    }>>('POST', `/api/v1/restaurants/${restaurant.id}/interest-tables`, {
      name: 'Founders Supper',
      topicId: topic.id,
      maxGuests: 6,
      startDate: '2026-12-01',
      startTime: '19:00',
      durationMinutes: 120,
      restaurantTableId: table.id,
      menuOptionIds: [combo.id],
      availabilityMode: 'AVAILABLE_NOW',
      publish: true,
    })
    expect(res.status).toBe(201)
    const it = res.json.data
    expect(it.restaurant.name).toBe(restaurant.name)
    expect(it.topic).toMatchObject({ id: topic.id, name: topic.name })
    expect(it.assignedTable).toEqual({ id: table.id, name: table.name })

    const menu = await call<Envelope<{ items: { id: string; name: string }[] }>>(
      'GET',
      `/api/v1/interest-tables/${it.id}/menu-options`,
    )
    expect(menu.json.data.items.map((m) => m.id)).toEqual([combo.id])

    // Nobody is invited to a brand-new table.
    const invitees = await call<Envelope<{ items: unknown[] }>>('GET', `/api/v1/interest-tables/${it.id}/invitees`)
    expect(invitees.json.data.items).toEqual([])

    // Editing the topic and table re-resolves their names.
    const otherTable = restaurant.tables[1]
    const edited = await call<Envelope<{ assignedTable: { name: string }; durationMinutes: number }>>(
      'PATCH',
      `/api/v1/interest-tables/${it.id}`,
      { restaurantTableId: otherTable.id, durationMinutes: 90, menuOptionIds: [] },
    )
    expect(edited.json.data.assignedTable.name).toBe(otherTable.name)
    expect(edited.json.data.durationMinutes).toBe(90)
  })

  it('is refused for a restaurant that does not exist', async () => {
    const res = await call('POST', '/api/v1/restaurants/missing/interest-tables', {
      name: 'x',
      topicId: 't1',
      maxGuests: 6,
      startDate: '2026-12-01',
      startTime: '19:00',
      durationMinutes: 120,
      restaurantTableId: 'tbl1',
      menuOptionIds: [],
      availabilityMode: 'AVAILABLE_NOW',
    })
    expect(res.status).toBe(404)
  })
})

/**
 * A multipart body built by hand: jsdom's FormData and Blob do not serialise
 * into the fetch implementation's request body.
 */
function multipart(fields: Record<string, string | { name: string; type: string; text: string }>) {
  const boundary = 'gm-test-boundary'
  const parts = Object.entries(fields).map(([key, value]) =>
    typeof value === 'string'
      ? `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      : `--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${value.name}"\r\nContent-Type: ${value.type}\r\n\r\n${value.text}\r\n`,
  )
  return {
    body: `${parts.join('')}--${boundary}--\r\n`,
    contentType: `multipart/form-data; boundary=${boundary}`,
  }
}

async function upload<T>(method: string, path: string, form: ReturnType<typeof multipart>) {
  const res = await fetch(new URL(path, window.location.origin), {
    method,
    headers: { 'Content-Type': form.contentType },
    body: form.body,
  })
  return { status: res.status, json: (await res.json()) as T }
}

describe('amenity icons', () => {
  it('keeps the uploaded icon file itself', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    const res = await upload<Envelope<{ id: string; iconUrl: string }>>(
      'POST',
      '/api/v1/amenities',
      multipart({ name: 'Rooftop Shisha', icon: { name: 'shisha.svg', type: 'image/svg+xml', text: svg } }),
    )
    expect(res.status).toBe(201)
    expect(res.json.data.iconUrl).toBe(`data:image/svg+xml;base64,${btoa(svg)}`)

    const patched = await upload<Envelope<{ iconUrl: string }>>(
      'PATCH',
      `/api/v1/amenities/${res.json.data.id}`,
      multipart({ icon: { name: 'new.svg', type: 'image/svg+xml', text: '<svg/>' } }),
    )
    expect(patched.json.data.iconUrl).toBe(`data:image/svg+xml;base64,${btoa('<svg/>')}`)
  })
})

describe('uploads', () => {
  it('serve the uploaded bytes back from the public URL used for topic graphics', async () => {
    const signed = await call<Envelope<{ uploadUrl: string; key: string }>>('POST', '/api/v1/uploads/signed-url', {
      fileName: 'g.png',
      contentType: 'image/png',
      purpose: 'TOPIC_GRAPHIC',
    })
    const { uploadUrl, key } = signed.json.data
    const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: 'PNGDATA' })
    expect(put.status).toBe(200)

    const topic = await call<{ graphicUrl: string } & Partial<Envelope<{ graphicUrl: string }>>>(
      'POST',
      '/api/v1/topics',
      { name: 'Board Games', description: null, interestIds: [], graphicKey: key },
    )
    const graphicUrl = topic.json.data?.graphicUrl ?? topic.json.graphicUrl
    expect(graphicUrl).toBe(`https://mock-bucket.local/${key}`)
    const image = await fetch(graphicUrl)
    expect(image.headers.get('content-type')).toBe('image/png')
    expect(await image.text()).toBe('PNGDATA')
    expect((await fetch('https://mock-bucket.local/topics/missing.png')).status).toBe(404)
  })
})

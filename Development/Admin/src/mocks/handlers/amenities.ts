import { http, HttpResponse } from 'msw'
import type { Amenity } from '../../app/modules/amenities/types'
import { mockAmenities } from '../data/amenities'

const BASE = '/api/v1/amenities'

// The real API stores an amenity icon under a stable per-amenity CDN key, so
// replacing the file leaves the URL unchanged — only updatedAt moves. Mirror
// that here so the mocks exercise the same cache-busting path as production.
const iconCdnUrl = (id: string) => `https://cdn.gomingle.com/amenities/${id}.svg`

/** A FormData entry is either a string or a file — `instanceof File` is not
 *  reliable here because Node's undici File is a different realm than jsdom's. */
const isUploadedFile = (entry: FormDataEntryValue | null): boolean =>
  entry !== null && typeof entry !== 'string'

export const amenitiesHandlers = [
  http.get(BASE, ({ request }) => {
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
    const rawPageSize = Number(url.searchParams.get('pageSize') ?? '25')
    const pageSize = [25, 50, 100].includes(rawPageSize) ? rawPageSize : 25
    const sortBy = (url.searchParams.get('sortBy') ?? 'name') as 'name' | 'count'
    const sortOrder = (url.searchParams.get('sortOrder') ?? 'asc') as 'asc' | 'desc'
    const q = url.searchParams.get('q') ?? ''

    let filtered = [...mockAmenities]
    if (q) {
      filtered = filtered.filter((a) => a.name.toLowerCase().includes(q.toLowerCase()))
    }

    filtered.sort((a, b) => {
      const dir = sortOrder === 'asc' ? 1 : -1
      if (sortBy === 'count') return (a.restaurantsCount - b.restaurantsCount) * dir
      return a.name.localeCompare(b.name) * dir
    })

    const totalRecords = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * pageSize
    const items = filtered.slice(start, start + pageSize)

    return HttpResponse.json({
      success: true,
      data: {
        items,
        pagination: { page: safePage, pageSize, totalRecords, totalPages },
      },
    })
  }),

  http.get(`${BASE}/active`, () => {
    const items = mockAmenities.map(({ id, name, iconUrl }) => ({ id, name, iconUrl }))
    return HttpResponse.json({ success: true, data: { items } })
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const found = mockAmenities.find((a) => a.id === params.id)
    if (!found) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ERR_AMENITY_NOT_FOUND', message: 'Amenity not found.', details: {} },
        },
        { status: 404 },
      )
    }
    return HttpResponse.json({ success: true, data: found })
  }),

  http.post(BASE, async ({ request }) => {
    const fd = await request.formData()
    const name = (fd.get('name') as string | null)?.trim() ?? ''

    if (!name) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ERR_VALIDATION', message: 'Name is required.', details: {} },
        },
        { status: 400 },
      )
    }

    const exists = mockAmenities.some((a) => a.name.toLowerCase() === name.toLowerCase())
    if (exists) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_AMENITY_NAME_IN_USE',
            message: 'Amenity name already exists.',
            details: { name },
          },
        },
        { status: 409 },
      )
    }

    const id = `a${mockAmenities.length + 1}`
    const icon = fd.get('icon')
    const created: Amenity = {
      id,
      name,
      iconUrl: isUploadedFile(icon) ? iconCdnUrl(id) : null,
      restaurantsCount: 0,
      sampleRestaurants: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    mockAmenities.push(created)
    return HttpResponse.json({ success: true, data: created }, { status: 201 })
  }),

  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    const id = params.id as string
    const fd = await request.formData()
    const name = (fd.get('name') as string | null)?.trim() ?? ''
    const resetIcon = fd.get('resetIcon') as string | null
    const icon = fd.get('icon')

    const idx = mockAmenities.findIndex((a) => a.id === id)
    if (idx < 0) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ERR_AMENITY_NOT_FOUND', message: 'Amenity not found.', details: {} },
        },
        { status: 404 },
      )
    }

    if (name) {
      const duplicate = mockAmenities.some(
        (a, i) => i !== idx && a.name.toLowerCase() === name.toLowerCase(),
      )
      if (duplicate) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_AMENITY_NAME_IN_USE',
              message: 'Amenity name already exists.',
              details: { name },
            },
          },
          { status: 409 },
        )
      }
    }

    const updated = { ...mockAmenities[idx] }
    if (name) updated.name = name
    // The FE sends either a replacement file or a reset flag, never both.
    if (isUploadedFile(icon)) updated.iconUrl = iconCdnUrl(id)
    else if (resetIcon === 'true') updated.iconUrl = null
    updated.updatedAt = new Date().toISOString()
    mockAmenities[idx] = updated

    return HttpResponse.json({ success: true, data: mockAmenities[idx] })
  }),

  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const idx = mockAmenities.findIndex((a) => a.id === id)
    if (idx < 0) {
      return HttpResponse.json(
        {
          success: false,
          error: { code: 'ERR_AMENITY_NOT_FOUND', message: 'Amenity not found.', details: {} },
        },
        { status: 404 },
      )
    }
    mockAmenities.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]

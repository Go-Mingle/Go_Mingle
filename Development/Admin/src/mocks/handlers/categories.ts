import { http, HttpResponse } from 'msw'
import type { Category } from '../../app/modules/categories/types'
import { mockCategories } from '../data/index'

const BASE = '/api/v1/categories'

export const categoriesHandlers = [
  http.get(BASE, () => HttpResponse.json(mockCategories)),

  http.get(`${BASE}/active`, () => {
    const items = mockCategories.map(({ id, name }) => ({ id, name }))
    return HttpResponse.json({ success: true, data: { items } })
  }),

  http.get(`${BASE}/:id`, ({ params }) => {
    const found = mockCategories.find((c) => c.id === params.id)
    if (!found) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    return HttpResponse.json(found)
  }),

  http.post(BASE, async ({ request }) => {
    const body = (await request.json()) as Omit<Category, 'id' | 'restaurantsCount' | 'createdAt'>
    const exists = mockCategories.some((c) => c.name.toLowerCase() === body.name.toLowerCase())
    if (exists) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_CATEGORY_NAME_IN_USE',
            message: 'Category name already exists.',
            details: { name: body.name },
          },
        },
        { status: 409 },
      )
    }
    const created: Category = {
      id: `c${Date.now()}`,
      ...body,
      restaurantsCount: 0,
      createdAt: new Date().toISOString(),
    }
    mockCategories.push(created)
    return HttpResponse.json(created, { status: 201 })
  }),

  http.patch(`${BASE}/:id`, async ({ params, request }) => {
    const id = params.id as string
    const body = (await request.json()) as Partial<Category>
    const idx = mockCategories.findIndex((c) => c.id === id)
    if (idx < 0) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    if (body.name) {
      const duplicate = mockCategories.some(
        (c, i) => i !== idx && c.name.toLowerCase() === (body.name as string).toLowerCase(),
      )
      if (duplicate) {
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_CATEGORY_NAME_IN_USE',
              message: 'Category name already exists.',
              details: { name: body.name },
            },
          },
          { status: 409 },
        )
      }
    }
    mockCategories[idx] = { ...mockCategories[idx], ...body }
    return HttpResponse.json(mockCategories[idx])
  }),

  http.delete(`${BASE}/:id`, ({ params }) => {
    const id = params.id as string
    const idx = mockCategories.findIndex((c) => c.id === id)
    if (idx < 0) return HttpResponse.json({ message: 'Not found' }, { status: 404 })
    const category = mockCategories[idx]
    if (category.restaurantsCount > 0) {
      return HttpResponse.json(
        {
          success: false,
          error: {
            code: 'ERR_CATEGORY_IN_USE',
            message: 'Cannot delete category. Reassign all restaurants first.',
            details: { restaurantsCount: category.restaurantsCount },
          },
        },
        { status: 409 },
      )
    }
    mockCategories.splice(idx, 1)
    return new HttpResponse(null, { status: 204 })
  }),
]

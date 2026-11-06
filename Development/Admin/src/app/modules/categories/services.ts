import { httpClient } from '../../../shared/api/httpClient'
import type { Category, CreateCategoryDto, UpdateCategoryDto } from './types'
import { CATEGORIES_ENDPOINTS } from './constants'

export type { CreateCategoryDto, UpdateCategoryDto }

export const categoriesService = {
  getAll: async (): Promise<Category[]> => {
    const res = await httpClient.get<{ items: Category[] } | Category[]>(CATEGORIES_ENDPOINTS.list)
    return Array.isArray(res) ? res : (res.items ?? [])
  },

  getActive: async (): Promise<Pick<Category, 'id' | 'name'>[]> => {
    const res = await httpClient.get<
      { items: Pick<Category, 'id' | 'name'>[] } | Pick<Category, 'id' | 'name'>[]
    >(CATEGORIES_ENDPOINTS.active)
    return Array.isArray(res) ? res : (res.items ?? [])
  },

  getById: (id: string): Promise<Category> =>
    httpClient.get<Category>(CATEGORIES_ENDPOINTS.byId(id)),

  create: (data: CreateCategoryDto): Promise<Category> =>
    httpClient.post<Category>(CATEGORIES_ENDPOINTS.list, data),

  update: (id: string, data: UpdateCategoryDto): Promise<Category> =>
    httpClient.patch<Category>(CATEGORIES_ENDPOINTS.byId(id), data),

  delete: (id: string): Promise<void> => httpClient.delete<void>(CATEGORIES_ENDPOINTS.byId(id)),
}

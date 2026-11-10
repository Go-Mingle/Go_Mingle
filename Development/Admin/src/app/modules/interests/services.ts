import { httpClient } from '../../../shared/api/httpClient'
import type {
  Interest,
  ActiveInterest,
  CreateInterestDto,
  UpdateInterestDto,
  InterestsListParams,
  InterestsListResponse,
} from './types'
import { INTERESTS_ENDPOINTS, INTERESTS_PAGE_SIZE } from './constants'

export type { CreateInterestDto, UpdateInterestDto }

/** Shapes the list endpoint has historically returned, newest first. */
type RawInterestsList = InterestsListResponse | { items?: Interest[] } | Interest[]

/**
 * The API answers with `{ items, pagination }`. A bare array or an `{ items }`
 * body without a pagination block is still tolerated (older/mocked responses) —
 * the meta is then derived from the requested params so callers always get a
 * complete envelope and never have to branch on the response shape.
 */
function normaliseList(res: RawInterestsList, params?: InterestsListParams): InterestsListResponse {
  const items = Array.isArray(res) ? res : (res.items ?? [])
  const meta = !Array.isArray(res) && 'pagination' in res ? res.pagination : undefined
  const pageSize = meta?.pageSize ?? params?.pageSize ?? INTERESTS_PAGE_SIZE
  const totalRecords = meta?.totalRecords ?? items.length
  return {
    items,
    pagination: {
      page: meta?.page ?? params?.page ?? 1,
      pageSize,
      totalRecords,
      totalPages: meta?.totalPages ?? (pageSize > 0 ? Math.ceil(totalRecords / pageSize) : 0),
    },
  }
}

export const interestsService = {
  /**
   * Fetch a page of interests. Pagination, search and sort are all resolved
   * server-side, so every page / page-size change issues its own request.
   */
  getAll: async (params?: InterestsListParams): Promise<InterestsListResponse> => {
    const qs = new URLSearchParams()
    if (params?.page !== undefined) qs.set('page', String(params.page))
    if (params?.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params?.q) qs.set('q', params.q)
    if (params?.sortBy) qs.set('sortBy', params.sortBy)
    if (params?.sortOrder) qs.set('sortOrder', params.sortOrder)
    const suffix = qs.toString() ? `?${qs.toString()}` : ''
    const res = await httpClient.get<RawInterestsList>(`${INTERESTS_ENDPOINTS.list}${suffix}`)
    return normaliseList(res, params)
  },

  /** Fetch active interests — used to source the create form's category dropdown. */
  getActive: async (): Promise<ActiveInterest[]> => {
    const res = await httpClient.get<{ items: ActiveInterest[] } | ActiveInterest[]>(
      INTERESTS_ENDPOINTS.active,
    )
    return Array.isArray(res) ? res : (res.items ?? [])
  },

  /** Fetch a single interest by ID (used to populate the edit modal). */
  getById: (id: string): Promise<Interest> =>
    httpClient.get<Interest>(INTERESTS_ENDPOINTS.byId(id)),

  /** Create a new interest. */
  create: (data: CreateInterestDto): Promise<Interest> =>
    httpClient.post<Interest>(INTERESTS_ENDPOINTS.list, data),

  /** Update an existing interest by ID. */
  update: (id: string, data: UpdateInterestDto): Promise<Interest> =>
    httpClient.patch<Interest>(INTERESTS_ENDPOINTS.byId(id), data),

  /** Delete an interest by ID. */
  delete: (id: string): Promise<void> => httpClient.delete<void>(INTERESTS_ENDPOINTS.byId(id)),
}

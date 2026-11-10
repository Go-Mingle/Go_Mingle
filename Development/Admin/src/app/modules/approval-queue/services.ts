import { httpClient } from '../../../shared/api/httpClient'
import { APPROVALS_ENDPOINTS } from './constants'
import type {
  Application,
  ApprovalApiItem,
  ApprovalApiListResponse,
  ApprovalDetailResponse,
  ApprovalListResult,
  ApproveRequest,
  ApproveResponse,
  DeclineRequest,
  DeclineResponse,
  ListApprovalsQueryParams,
} from './types'

/** Normalise a raw API item to the UI row shape used across the tables/cards. */
function mapItem(item: ApprovalApiItem, status: 'PENDING' | 'REJECTED'): Application {
  return {
    id: item.id,
    name: item.name,
    cuisine: item.cuisine,
    owner: item.ownerName,
    phone: item.ownerPhone ?? '',
    email: item.ownerEmail ?? '',
    city: item.city,
    submitted: item.submittedAt,
    status,
    rejectedOn: item.rejectedAt,
    rejectionReason: item.latestReason,
    avatarUrl: item.avatarUrl,
  }
}

export const approvalQueueService = {
  /** GET /api/v1/admin/approvals — server-driven queue listing. */
  getAll: async (params: ListApprovalsQueryParams = {}): Promise<ApprovalListResult> => {
    const qs = new URLSearchParams()
    if (params.status) qs.set('status', params.status)
    if (params.page) qs.set('page', String(params.page))
    if (params.pageSize) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    const restaurant = params.restaurant?.trim().slice(0, 100)
    if (restaurant) qs.set('restaurant', restaurant)
    const owner = params.owner?.trim().slice(0, 100)
    if (owner) qs.set('owner', owner)
    const city = params.city?.trim().slice(0, 100)
    if (city) qs.set('city', city)
    const url = qs.toString() ? `${APPROVALS_ENDPOINTS.list}?${qs}` : APPROVALS_ENDPOINTS.list
    const res = await httpClient.get<ApprovalApiListResponse>(url)
    const status = params.status === 'rejected' ? 'REJECTED' : 'PENDING'
    return {
      items: (res.items ?? []).map((item) => mapItem(item, status)),
      pagination: res.pagination,
    }
  },

  /** GET /api/v1/admin/approvals/{id} — status context + rejection history. */
  getById: (id: string): Promise<ApprovalDetailResponse> =>
    httpClient.get<ApprovalDetailResponse>(APPROVALS_ENDPOINTS.byId(id)),

  /** POST /api/v1/admin/approvals/{id}/approve */
  approve: (id: string, body: ApproveRequest): Promise<ApproveResponse> =>
    httpClient.post<ApproveResponse>(APPROVALS_ENDPOINTS.approve(id), body),

  /** POST /api/v1/admin/approvals/{id}/decline */
  decline: (id: string, body: DeclineRequest): Promise<DeclineResponse> =>
    httpClient.post<DeclineResponse>(APPROVALS_ENDPOINTS.decline(id), body),
}

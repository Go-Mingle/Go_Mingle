import { httpClient } from '../../../shared/api/httpClient'
import { INTEREST_TABLE_ENDPOINTS } from './constants'
import type {
  InterestTable,
  InterestTableListData,
  InterestTableMenuOptionItem,
  CreateInterestTablePayload,
  ListInterestTablesQuery,
  ListAllInterestTablesParams,
  MasterInterestTableListData,
  AvailabilityCheckResult,
  UpdateInterestTablePayload,
  MakeAvailableResult,
  InviteesListData,
  ListInviteesQuery,
  InviteeRow,
  RemoveInviteeResult,
  CancelInterestTableResult,
  ProminglerLookupItem,
  MinglerLookupItem,
} from './types'

export const interestTablesService = {
  /**
   * Cross-restaurant master list (CR-43). Every filter, sort and page is applied
   * server-side. Multi-select params are sent as repeated keys — the API accepts
   * both that and CSV, and repeated keys match the idiom used elsewhere in the app.
   */
  listAll: (params: ListAllInterestTablesParams = {}): Promise<MasterInterestTableListData> => {
    const qs = new URLSearchParams()
    if (params.page !== undefined) qs.set('page', String(params.page))
    if (params.pageSize !== undefined) qs.set('pageSize', String(params.pageSize))
    if (params.sortBy) qs.set('sortBy', params.sortBy)
    if (params.sortOrder) qs.set('sortOrder', params.sortOrder)
    if (params.search) qs.set('search', params.search)
    if (params.searchField) qs.set('searchField', params.searchField)
    params.availabilityMode?.forEach((mode) => qs.append('availabilityMode', mode))
    params.status?.forEach((status) => qs.append('status', status))
    params.restaurantId?.forEach((id) => qs.append('restaurantId', id))
    if (params.inviteOnly !== undefined) qs.set('inviteOnly', String(params.inviteOnly))
    const str = qs.toString()
    return httpClient.get<MasterInterestTableListData>(
      `${INTEREST_TABLE_ENDPOINTS.listAll}${str ? `?${str}` : ''}`,
    )
  },

  listByRestaurant: (
    rid: string,
    query?: ListInterestTablesQuery,
  ): Promise<InterestTableListData> => {
    const qs = new URLSearchParams()
    if (query?.page !== undefined) qs.set('page', String(query.page))
    if (query?.pageSize !== undefined) qs.set('pageSize', String(query.pageSize))
    if (query?.sortBy) qs.set('sortBy', query.sortBy)
    if (query?.sortOrder) qs.set('sortOrder', query.sortOrder)
    if (query?.q) qs.set('q', query.q)
    if (query?.status) qs.set('status', query.status)
    const str = qs.toString()
    return httpClient.get<InterestTableListData>(
      `${INTEREST_TABLE_ENDPOINTS.listByRestaurant(rid)}${str ? `?${str}` : ''}`,
    )
  },

  getDetail: (id: string): Promise<InterestTable> =>
    httpClient.get<InterestTable>(INTEREST_TABLE_ENDPOINTS.detail(id)),

  getMenuOptions: async (id: string): Promise<InterestTableMenuOptionItem[]> => {
    // The API returns { data: { items: [...] } }; the shared client unwraps the
    // envelope to `data`, so read `.items`. The list may be empty/absent.
    const res = await httpClient.get<{ items?: InterestTableMenuOptionItem[] } | null>(
      INTEREST_TABLE_ENDPOINTS.menuOptions(id),
    )
    return res?.items ?? []
  },

  create: (rid: string, payload: CreateInterestTablePayload): Promise<InterestTable> =>
    httpClient.post<InterestTable>(INTEREST_TABLE_ENDPOINTS.create(rid), payload),

  update: (id: string, payload: UpdateInterestTablePayload): Promise<InterestTable> =>
    httpClient.patch<InterestTable>(INTEREST_TABLE_ENDPOINTS.update(id), payload),

  remove: (id: string): Promise<void> =>
    httpClient.delete<void>(INTEREST_TABLE_ENDPOINTS.remove(id)),

  makeAvailable: (id: string): Promise<MakeAvailableResult> =>
    httpClient.post<MakeAvailableResult>(INTEREST_TABLE_ENDPOINTS.makeAvailable(id), {}),

  // Publish a DRAFT (→ PENDING/COMING_SOON per its availability mode). No body.
  publish: (id: string): Promise<InterestTable> =>
    httpClient.post<InterestTable>(INTEREST_TABLE_ENDPOINTS.publish(id), {}),

  // Admin cancel (J10C refund cascade runs server-side). No body.
  cancel: (id: string): Promise<CancelInterestTableResult> =>
    httpClient.post<CancelInterestTableResult>(INTEREST_TABLE_ENDPOINTS.cancel(id), {}),

  // Change the assigned Promingler (J10C cancels/creates the bookings server-side).
  changePromingler: (id: string, prominglerMinglerId: string): Promise<InterestTable> =>
    httpClient.post<InterestTable>(INTEREST_TABLE_ENDPOINTS.promingler(id), {
      prominglerMinglerId,
    }),

  getActiveProminglers: async (): Promise<ProminglerLookupItem[]> => {
    const res = await httpClient.get<{ items?: ProminglerLookupItem[] } | null>(
      INTEREST_TABLE_ENDPOINTS.activeProminglers,
    )
    return res?.items ?? []
  },

  getMinglersLookup: async (q?: string): Promise<MinglerLookupItem[]> => {
    const qs = new URLSearchParams()
    if (q) qs.set('search', q)
    const str = qs.toString()
    const res = await httpClient.get<{ items?: MinglerLookupItem[] } | null>(
      `${INTEREST_TABLE_ENDPOINTS.minglersLookup}${str ? `?${str}` : ''}`,
    )
    return res?.items ?? []
  },

  getInvitees: (id: string, query: ListInviteesQuery = {}): Promise<InviteesListData> => {
    const qs = new URLSearchParams()
    if (query.page !== undefined) qs.set('page', String(query.page))
    if (query.pageSize !== undefined) qs.set('pageSize', String(query.pageSize))
    if (query.sortBy) qs.set('sortBy', query.sortBy)
    if (query.sortOrder) qs.set('sortOrder', query.sortOrder)
    if (query.status) qs.set('status', query.status)
    if (query.q) qs.set('q', query.q)
    const str = qs.toString()
    const suffix = str ? `?${str}` : ''
    return httpClient.get<InviteesListData>(`${INTEREST_TABLE_ENDPOINTS.invitees(id)}${suffix}`)
  },

  addInvitee: (id: string, minglerId: string): Promise<InviteeRow> =>
    httpClient.post<InviteeRow>(INTEREST_TABLE_ENDPOINTS.invitees(id), { minglerId }),

  removeInvitee: (id: string, minglerId: string): Promise<RemoveInviteeResult> =>
    httpClient.delete<RemoveInviteeResult>(INTEREST_TABLE_ENDPOINTS.inviteeById(id, minglerId)),

  checkAvailability: (
    rid: string,
    tid: string,
    params: { startDate: string; startTime: string; durationMinutes: number },
  ): Promise<AvailabilityCheckResult> => {
    const qs = new URLSearchParams({
      startDate: params.startDate,
      startTime: params.startTime,
      durationMinutes: String(params.durationMinutes),
    })
    return httpClient.get<AvailabilityCheckResult>(
      `${INTEREST_TABLE_ENDPOINTS.availabilityCheck(rid, tid)}?${qs.toString()}`,
    )
  },
}

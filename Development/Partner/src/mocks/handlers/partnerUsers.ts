import { http } from 'msw'
import { PARTNER_USERS_ENDPOINTS } from '../../app/modules/users/constants'
import {
  createMockPartnerUser,
  deleteMockPartnerUser,
  listPartnerUsers,
  setMockPartnerUserPassword,
  updateMockPartnerUser,
} from '../data/partnerUsers'

/** J3's five endpoints. Restaurant scope comes from the token, never the request. */
export const partnerUsersHandlers = [
  http.get(PARTNER_USERS_ENDPOINTS.list, ({ request }) => {
    const url = new URL(request.url)
    return listPartnerUsers({
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
      sortBy: url.searchParams.get('sortBy'),
      sortOrder: url.searchParams.get('sortOrder'),
      search: url.searchParams.get('search'),
      searchField: url.searchParams.get('searchField'),
      // Accepted as repeated keys or as CSV, matching the backend.
      status: url.searchParams
        .getAll('status')
        .flatMap((value) => value.split(','))
        .filter(Boolean),
      lastActiveFrom: url.searchParams.get('lastActiveFrom'),
      lastActiveTo: url.searchParams.get('lastActiveTo'),
    })
  }),

  http.post(PARTNER_USERS_ENDPOINTS.list, async ({ request }) =>
    createMockPartnerUser((await request.json()) as Record<string, unknown>),
  ),

  http.post(`${PARTNER_USERS_ENDPOINTS.list}/:userId/set-password`, async ({ params, request }) =>
    setMockPartnerUserPassword(
      String(params.userId),
      (await request.json()) as Record<string, unknown>,
    ),
  ),

  http.patch(`${PARTNER_USERS_ENDPOINTS.list}/:userId`, async ({ params, request }) =>
    updateMockPartnerUser(String(params.userId), (await request.json()) as Record<string, unknown>),
  ),

  http.delete(`${PARTNER_USERS_ENDPOINTS.list}/:userId`, ({ params }) =>
    deleteMockPartnerUser(String(params.userId)),
  ),
]

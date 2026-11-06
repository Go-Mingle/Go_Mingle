import { http } from 'msw'
import { FINANCES_ENDPOINTS } from '../../app/modules/finances/constants'
import {
  exportMockFinances,
  listMockFinances,
  mockFinanceDetail,
  type FinancesQuery,
} from '../data/partnerFinances'

function readQuery(url: string): FinancesQuery {
  const params = new URL(url).searchParams
  return {
    page: params.get('page'),
    pageSize: params.get('pageSize'),
    sortBy: params.get('sortBy'),
    sortOrder: params.get('sortOrder'),
    searchField: params.get('searchField'),
    search: params.get('search'),
    period: params.get('period'),
    dateFrom: params.get('dateFrom'),
    dateTo: params.get('dateTo'),
    restaurantId: params.get('restaurantId'),
  }
}

/**
 * J5's three read-only endpoints.
 *
 * The export is registered before the `:bookingId` route so the literal path
 * wins — otherwise `/finances/export` would resolve as a booking id.
 */
export const partnerFinancesHandlers = [
  http.get(FINANCES_ENDPOINTS.ledger, ({ request }) => listMockFinances(readQuery(request.url))),

  http.get(FINANCES_ENDPOINTS.export, ({ request }) => exportMockFinances(readQuery(request.url))),

  http.get(`${FINANCES_ENDPOINTS.ledger}/:bookingId`, ({ params }) =>
    mockFinanceDetail(String(params.bookingId)),
  ),
]

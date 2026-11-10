import { http } from 'msw'
import { PARTNER_TABLES_ENDPOINTS } from '../../app/modules/restaurants/partnerTables/constants'
import {
  createMockTable,
  deleteMockTable,
  listMockTables,
  setMockTableVisibility,
  updateMockTable,
} from '../data/partnerTables'

/**
 * J6E's five endpoints.
 *
 * `/{tableId}/visibility` is registered **before** the parameterised route or MSW
 * matches it as a `tableId` and the toggle silently hits the edit handler — the
 * same ordering J6A, J6B and J6D needed.
 */
export const partnerTablesHandlers = [
  http.patch(PARTNER_TABLES_ENDPOINTS.tableVisibility(':tableId'), async ({ params, request }) =>
    setMockTableVisibility(
      String(params.tableId),
      (await request.json()) as Record<string, unknown>,
    ),
  ),

  http.get(PARTNER_TABLES_ENDPOINTS.tables, () => listMockTables()),

  http.post(PARTNER_TABLES_ENDPOINTS.tables, async ({ request }) =>
    createMockTable((await request.json()) as Record<string, unknown>),
  ),

  http.patch(PARTNER_TABLES_ENDPOINTS.tableById(':tableId'), async ({ params, request }) =>
    updateMockTable(String(params.tableId), (await request.json()) as Record<string, unknown>),
  ),

  http.delete(PARTNER_TABLES_ENDPOINTS.tableById(':tableId'), ({ params }) =>
    deleteMockTable(String(params.tableId)),
  ),
]

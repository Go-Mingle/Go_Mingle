import { httpClient } from '../../../../shared/api/httpClient'
import { PARTNER_TABLES_ENDPOINTS } from './constants'
import type {
  PartnerTable,
  TableDeletedResponse,
  TableDraft,
  TableVisibilityResponse,
} from './types'

export const partnerTablesService = {
  /**
   * The card grid (US-01).
   *
   * Unpaginated — a restaurant has a handful of table areas. Hidden tables are
   * **included**; the tab badges them rather than filtering them out. This read
   * also works while the profile is PENDING, which is what lets the tab render
   * read-only instead of erroring.
   */
  listTables: (): Promise<{ items: PartnerTable[] }> =>
    httpClient.get<{ items: PartnerTable[] }>(PARTNER_TABLES_ENDPOINTS.tables),

  /**
   * Creates a table and its weekly windows in one transactional write (US-02).
   *
   * `availability` is optional on the wire and a closed day may be omitted, but
   * we always send all seven keys — see {@link updateTable} for why that matters,
   * and sending one shape for both keeps the request identical to the edit.
   */
  createTable: (draft: TableDraft): Promise<PartnerTable> =>
    httpClient.post<PartnerTable>(PARTNER_TABLES_ENDPOINTS.tables, draft),

  /**
   * Renames a table and **replaces** its whole week (US-03, BR-07).
   *
   * A full replace, not a partial patch: an omitted weekday is read as "the
   * partner closed it", so a diff would silently wipe hours nobody touched. The
   * caller always sends the modal's complete seven-day state.
   */
  updateTable: (tableId: string, draft: TableDraft): Promise<PartnerTable> =>
    httpClient.patch<PartnerTable>(PARTNER_TABLES_ENDPOINTS.tableById(tableId), draft),

  /**
   * Hide/show — the offerable-pool control (US-04, BR-08).
   *
   * Note the deliberate asymmetry the spec names: the request key is `hidden`, the
   * response key is `isHidden`. Idempotent, so a double-tap is safe.
   */
  setTableVisibility: (tableId: string, hidden: boolean): Promise<TableVisibilityResponse> =>
    httpClient.patch<TableVisibilityResponse>(PARTNER_TABLES_ENDPOINTS.tableVisibility(tableId), {
      hidden,
    }),

  /**
   * Soft delete, cascading to the table's availability rows (US-05).
   *
   * Guarded: refused with `409 ERR_TABLE_IN_USE` while the table is assigned to an
   * interest table that has not completed or been cancelled (BR-09). It becomes
   * deletable once those tables end; until then, hiding is the alternative.
   */
  deleteTable: (tableId: string): Promise<TableDeletedResponse> =>
    httpClient.delete<TableDeletedResponse>(PARTNER_TABLES_ENDPOINTS.tableById(tableId)),
}

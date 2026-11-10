import { httpClient } from '../../../shared/api/httpClient'
import type { FileDownload } from '../../../shared/api/httpClient'
import { FINANCES_ENDPOINTS } from './constants'
import { buildFinancesQuery, toExportParams } from './financesParams'
import type { PartnerEscrowOverview } from './escrowTypes'
import type { FinanceLedgerPage, FinanceTransactionDetail, FinancesLedgerParams } from './types'

/**
 * J5's three read-only endpoints. Restaurant scope is resolved from the token on
 * every one (BR-04); no `restaurantId` is ever sent.
 */
export const financesService = {
  /** Mingler payments held for this restaurant in Safepay escrow, and its payouts. */
  getEscrow: (): Promise<PartnerEscrowOverview> =>
    httpClient.get<PartnerEscrowOverview>(FINANCES_ENDPOINTS.escrow),

  /** The paginated ledger of COMPLETED bookings (US-01). */
  getLedger: (params: FinancesLedgerParams = {}): Promise<FinanceLedgerPage> =>
    httpClient.get<FinanceLedgerPage>(`${FINANCES_ENDPOINTS.ledger}${buildFinancesQuery(params)}`),

  /**
   * One transaction's full split (US-03).
   *
   * A 404 means three things at once — no such booking, another restaurant's
   * booking, or one that is not COMPLETED — and is deliberately
   * indistinguishable, so the caller shows a single message and never branches.
   */
  getDetail: (bookingId: string): Promise<FinanceTransactionDetail> =>
    httpClient.get<FinanceTransactionDetail>(FINANCES_ENDPOINTS.detail(bookingId)),

  /**
   * The CSV of the whole filtered set (US-05) — a direct download, no signed URL
   * and no polling. Pagination params are stripped because the export rejects
   * them with a 422 rather than ignoring them.
   */
  exportCsv: (params: FinancesLedgerParams = {}): Promise<FileDownload> =>
    httpClient.download(
      `${FINANCES_ENDPOINTS.export}${buildFinancesQuery(toExportParams(params))}`,
    ),
}

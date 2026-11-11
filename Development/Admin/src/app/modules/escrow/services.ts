import { httpClient } from '../../../shared/api/httpClient'
import { ESCROW_ENDPOINTS } from './constants'
import type {
  EscrowAction,
  EscrowItem,
  EscrowOverview,
  EscrowStatus,
  InterestTableOption,
  TableBookingResult,
  TestBookingRequest,
  TestCardRequest,
} from './types'

export const escrowService = {
  getOverview: (status?: EscrowStatus): Promise<EscrowOverview> =>
    httpClient.get<EscrowOverview>(
      status ? `${ESCROW_ENDPOINTS.overview}?status=${status}` : ESCROW_ENDPOINTS.overview,
    ),

  createTestBooking: (body: TestBookingRequest): Promise<EscrowItem> =>
    httpClient.post<EscrowItem>(ESCROW_ENDPOINTS.testBooking, body),

  /** Books seats at an interest table; the card hold is the no-show penalty × seats. */
  createTableBooking: (body: { interestTableId: string; minglerName: string; seats: number }): Promise<TableBookingResult> =>
    httpClient.post<TableBookingResult>(ESCROW_ENDPOINTS.tableBooking, body),

  listInterestTables: (restaurantId: string): Promise<{ items: InterestTableOption[] }> =>
    httpClient.get<{ items: InterestTableOption[] }>(ESCROW_ENDPOINTS.interestTables(restaurantId)),

  /** TEMPORARY (GM-255): covers every waiting hold of the same booking. */
  addTestCard: (id: string, body: TestCardRequest): Promise<{ items: EscrowItem[] }> =>
    httpClient.post<{ items: EscrowItem[] }>(ESCROW_ENDPOINTS.testCard(id), body),

  retryFailure: (id: number): Promise<{ id: number; resolved: boolean }> =>
    httpClient.post<{ id: number; resolved: boolean }>(ESCROW_ENDPOINTS.retryFailure(id), {}),

  resolveFailure: (id: number, note: string): Promise<{ id: number; resolved: boolean }> =>
    httpClient.post<{ id: number; resolved: boolean }>(ESCROW_ENDPOINTS.resolveFailure(id), { note }),

  act: (id: string, action: EscrowAction, reason?: string): Promise<EscrowItem> =>
    httpClient.post<EscrowItem>(ESCROW_ENDPOINTS.action(id, action), reason ? { reason } : {}),
}

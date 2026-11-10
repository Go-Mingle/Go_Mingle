import { httpClient } from '../../../shared/api/httpClient'
import { ESCROW_ENDPOINTS } from './constants'
import type { EscrowAction, EscrowItem, EscrowOverview, EscrowStatus, TestBookingRequest } from './types'

export const escrowService = {
  getOverview: (status?: EscrowStatus): Promise<EscrowOverview> =>
    httpClient.get<EscrowOverview>(
      status ? `${ESCROW_ENDPOINTS.overview}?status=${status}` : ESCROW_ENDPOINTS.overview,
    ),

  createTestBooking: (body: TestBookingRequest): Promise<EscrowItem> =>
    httpClient.post<EscrowItem>(ESCROW_ENDPOINTS.testBooking, body),

  act: (id: string, action: EscrowAction, reason?: string): Promise<EscrowItem> =>
    httpClient.post<EscrowItem>(ESCROW_ENDPOINTS.action(id, action), reason ? { reason } : {}),
}

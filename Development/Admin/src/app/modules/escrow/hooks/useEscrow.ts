import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ESCROW_QUERY_KEY } from '../constants'
import { escrowService } from '../services'
import type { EscrowAction, EscrowStatus, TestBookingRequest } from '../types'

export function useEscrowQuery(status?: EscrowStatus) {
  return useQuery({
    queryKey: [...ESCROW_QUERY_KEY, status ?? 'all'],
    queryFn: () => escrowService.getOverview(status),
  })
}

export function useEscrowActionMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: EscrowAction; reason?: string }) =>
      escrowService.act(id, action, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ESCROW_QUERY_KEY })
    },
  })
}

export function useTestBookingMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: TestBookingRequest) => escrowService.createTestBooking(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ESCROW_QUERY_KEY })
    },
  })
}

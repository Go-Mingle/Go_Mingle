import { useMutation, useQuery } from '@tanstack/react-query'
import { partnerRetryPolicy } from '../../../../shared/api/retryPolicy'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import {
  FINANCES_DETAIL_QUERY_KEY,
  FINANCES_ESCROW_QUERY_KEY,
  FINANCES_LEDGER_QUERY_KEY,
} from '../constants'
import type { PartnerEscrowOverview } from '../escrowTypes'
import { financesService } from '../services'
import type { FinanceLedgerPage, FinanceTransactionDetail, FinancesLedgerParams } from '../types'

/**
 * J5's server state. Everything is read-only, so there is nothing to invalidate:
 * the export is modelled as a mutation only because it is user-triggered and the
 * caller needs `isPending` and `onError`.
 */

/** The ledger grid. Params are part of the key so each view caches separately. */
export function useFinancesLedgerQuery(params: FinancesLedgerParams) {
  return useQuery<FinanceLedgerPage>({
    queryKey: [...FINANCES_LEDGER_QUERY_KEY, params],
    queryFn: () => financesService.getLedger(params),
    enabled: tokenStore.hasSession(),
    // Keeps the current page visible while the next loads, so paging and
    // filtering do not blank the table on every interaction.
    placeholderData: (previous) => previous,
    ...partnerRetryPolicy,
  })
}

/**
 * One transaction's split, fetched when a row is clicked. The grid deliberately
 * does not carry the GoMingle share or the loyalty pair, so the modal cannot be
 * populated from the row — it has to ask.
 */
export function useFinanceDetailQuery(bookingId: string | null) {
  return useQuery<FinanceTransactionDetail>({
    queryKey: [...FINANCES_DETAIL_QUERY_KEY, bookingId],
    queryFn: () => financesService.getDetail(bookingId as string),
    enabled: !!bookingId && tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

/**
 * The CSV export. Returns the blob and the server's filename; saving it is the
 * caller's job so the toast and the download stay together.
 */
export function useFinancesExportMutation() {
  return useMutation({
    mutationFn: (params: FinancesLedgerParams) => financesService.exportCsv(params),
  })
}

/** The restaurant's Safepay escrow balance, payout account and recent payouts. */
export function usePartnerEscrowQuery() {
  return useQuery<PartnerEscrowOverview>({
    queryKey: FINANCES_ESCROW_QUERY_KEY,
    queryFn: () => financesService.getEscrow(),
    enabled: tokenStore.hasSession(),
    ...partnerRetryPolicy,
  })
}

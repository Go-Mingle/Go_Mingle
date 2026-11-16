import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { httpClient } from '../../../shared/api/httpClient'
import { tokenStore } from '../../../shared/auth/tokenStore'
import { partnerRetryPolicy } from '../../../shared/api/retryPolicy'
import type { Insights, Range } from '../../visual/insights'

export const DASHBOARD_ENDPOINT = '/api/v1/partner/dashboard'
export const dashboardQueryKey = (days: Range) => ['partner', 'dashboard', days] as const

/** The restaurant's own figures for the last 7, 30 or 90 days. */
export function useDashboardQuery(days: Range) {
  return useQuery<Insights>({
    queryKey: dashboardQueryKey(days),
    queryFn: () => httpClient.get<Insights>(`${DASHBOARD_ENDPOINT}?days=${days}`),
    enabled: tokenStore.hasSession(),
    // Switching the period keeps the old figures on screen until the new ones arrive.
    placeholderData: keepPreviousData,
    ...partnerRetryPolicy,
  })
}

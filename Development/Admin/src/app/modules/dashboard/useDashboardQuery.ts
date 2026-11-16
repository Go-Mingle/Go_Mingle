import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { httpClient } from '../../../shared/api/httpClient'
import type { Insights, Range } from '../../visual/insights'

export const DASHBOARD_ENDPOINT = '/api/dashboard/overview'
export const dashboardQueryKey = (days: Range) => ['admin', 'dashboard', days] as const

/** Bookings and money across every restaurant for the last 7, 30 or 90 days. */
export function useDashboardQuery(days: Range) {
  return useQuery<Insights>({
    queryKey: dashboardQueryKey(days),
    queryFn: () => httpClient.get<Insights>(`${DASHBOARD_ENDPOINT}?days=${days}`),
    // Switching the period keeps the old figures on screen until the new ones arrive.
    placeholderData: keepPreviousData,
  })
}

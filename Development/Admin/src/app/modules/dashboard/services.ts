import { httpClient } from '../../../shared/api/httpClient'
import type { RevenueData } from './types'
import { DASHBOARD_ENDPOINTS } from './constants'

export type { RevenueData }

export const dashboardService = {
  /** Fetch revenue chart data for the dashboard. */
  getRevenueChart: (): Promise<RevenueData> =>
    httpClient.get<RevenueData>(DASHBOARD_ENDPOINTS.revenueChart),
}

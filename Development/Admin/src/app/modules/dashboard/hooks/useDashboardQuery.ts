import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services'

export function useDashboardRevenueQuery() {
  return useQuery({
    queryKey: ['dashboard-revenue'],
    queryFn: () => dashboardService.getRevenueChart(),
  })
}

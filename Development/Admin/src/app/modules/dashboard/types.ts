export interface RevenueData {
  commissions: number
  penalties: number
  total: number
  trend: string
  [key: string]: unknown
}

export interface KpiCardData {
  label: string
  value: string | number
  delta?: number
  trend?: 'up' | 'down' | 'flat'
}

export interface DashboardChartPoint {
  label: string
  value: number
}

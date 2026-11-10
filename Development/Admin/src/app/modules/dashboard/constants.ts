export const DASHBOARD_ENDPOINTS = {
  revenueChart: '/api/dashboard/revenue-chart',
  kpis: '/api/dashboard/kpis',
} as const

export const DASHBOARD_REFRESH_INTERVAL_MS = 60_000
export const KPI_TREND_THRESHOLD_PERCENT = 5
export const DASHBOARD_DEFAULT_RANGE_DAYS = 30
export const DASHBOARD_CHART_HEIGHT_PX = 240

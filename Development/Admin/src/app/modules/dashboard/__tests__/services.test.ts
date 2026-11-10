import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { dashboardService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('dashboardService', () => {
  it('getRevenueChart returns on 200', async () => {
    server.use(
      http.get('/api/dashboard/revenue-chart', () =>
        HttpResponse.json({ commissions: 1, penalties: 2, total: 3, trend: 'up' }),
      ),
    )
    const r = await dashboardService.getRevenueChart()
    expect(r.total).toBe(3)
  })

  it('throws on 500', async () => {
    server.use(
      http.get('/api/dashboard/revenue-chart', () => HttpResponse.json({}, { status: 500 })),
    )
    await expect(dashboardService.getRevenueChart()).rejects.toBeInstanceOf(HttpError)
  })

  it('throws on network error', async () => {
    server.use(http.get('/api/dashboard/revenue-chart', () => HttpResponse.error()))
    await expect(dashboardService.getRevenueChart()).rejects.toBeTruthy()
  })
})

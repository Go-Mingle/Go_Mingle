import { describe, it, expect } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../../../../mocks/server'
import { loyaltyService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'
import type {
  LoyaltyConfigurationData,
  UpdateEarnRatePayload,
  UpdateRedeemRatePayload,
} from '../types'

const BASE_DATA: LoyaltyConfigurationData = {
  pkrSpentToEarn1Point: 10,
  bonusPointsAt10thBooking: 100,
  pointsPerAcceptedInvite: 50,
  pointsPerReviewWithPhoto: 25,
  pointsPerCrownProminglerRole: 75,
  pointsPerInterestTableShare: 15,
  pointsNeededForPkr1Off: 100,
  maxRedemptionPercentOfBill: 50,
  earnUpdatedAt: null,
  earnUpdatedBy: null,
  redeemUpdatedAt: null,
  redeemUpdatedBy: null,
}

describe('loyaltyService.getCurrent', () => {
  it('returns LoyaltyConfigurationData on 200', async () => {
    server.use(
      http.get('/api/v1/loyalty-configuration', () =>
        HttpResponse.json({ success: true, data: BASE_DATA }),
      ),
    )
    const result = await loyaltyService.getCurrent()
    expect(result).toEqual(BASE_DATA)
  })

  it('throws HttpError on 500', async () => {
    server.use(
      http.get('/api/v1/loyalty-configuration', () =>
        HttpResponse.json({ message: 'internal error' }, { status: 500 }),
      ),
    )
    await expect(loyaltyService.getCurrent()).rejects.toBeInstanceOf(HttpError)
  })

  it('throws on network failure', async () => {
    server.use(http.get('/api/v1/loyalty-configuration', () => HttpResponse.error()))
    await expect(loyaltyService.getCurrent()).rejects.toBeTruthy()
  })
})

describe('loyaltyService.saveEarnRate', () => {
  const EARN_PAYLOAD: UpdateEarnRatePayload = {
    pkrSpentToEarn1Point: 15,
    bonusPointsAt10thBooking: 200,
    pointsPerAcceptedInvite: 60,
    pointsPerReviewWithPhoto: 30,
    pointsPerCrownProminglerRole: 80,
    pointsPerInterestTableShare: 20,
  }

  it('accepts UpdateEarnRatePayload and returns LoyaltyConfigurationData on 200', async () => {
    const updated: LoyaltyConfigurationData = { ...BASE_DATA, ...EARN_PAYLOAD }
    server.use(
      http.patch('/api/v1/loyalty-configuration/earn-rate', async ({ request }) => {
        const body = (await request.json()) as UpdateEarnRatePayload
        return HttpResponse.json({ success: true, data: { ...BASE_DATA, ...body } })
      }),
    )
    const result = await loyaltyService.saveEarnRate(EARN_PAYLOAD)
    expect(result).toEqual(updated)
  })

  it('throws HttpError on 400', async () => {
    server.use(
      http.patch('/api/v1/loyalty-configuration/earn-rate', () =>
        HttpResponse.json({ message: 'validation failed' }, { status: 400 }),
      ),
    )
    await expect(loyaltyService.saveEarnRate(EARN_PAYLOAD)).rejects.toBeInstanceOf(HttpError)
  })

  it('throws on network failure', async () => {
    server.use(http.patch('/api/v1/loyalty-configuration/earn-rate', () => HttpResponse.error()))
    await expect(loyaltyService.saveEarnRate(EARN_PAYLOAD)).rejects.toBeTruthy()
  })
})

describe('loyaltyService.saveRedeemRate', () => {
  const REDEEM_PAYLOAD: UpdateRedeemRatePayload = {
    pointsNeededForPkr1Off: 150,
    maxRedemptionPercentOfBill: 40,
  }

  it('accepts UpdateRedeemRatePayload and returns LoyaltyConfigurationData on 200', async () => {
    const updated: LoyaltyConfigurationData = { ...BASE_DATA, ...REDEEM_PAYLOAD }
    server.use(
      http.patch('/api/v1/loyalty-configuration/redeem-rate', async ({ request }) => {
        const body = (await request.json()) as UpdateRedeemRatePayload
        return HttpResponse.json({ success: true, data: { ...BASE_DATA, ...body } })
      }),
    )
    const result = await loyaltyService.saveRedeemRate(REDEEM_PAYLOAD)
    expect(result).toEqual(updated)
  })

  it('throws HttpError on 400', async () => {
    server.use(
      http.patch('/api/v1/loyalty-configuration/redeem-rate', () =>
        HttpResponse.json({ message: 'validation failed' }, { status: 400 }),
      ),
    )
    await expect(loyaltyService.saveRedeemRate(REDEEM_PAYLOAD)).rejects.toBeInstanceOf(HttpError)
  })
})

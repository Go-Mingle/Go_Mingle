import { beforeEach, describe, expect, it } from 'vitest'
import { resetMockEscrow } from '../../../../mocks/handlers/escrow'
import { escrowService } from '../services'
import { HttpError } from '../../../../shared/api/httpClient'

describe('escrowService', () => {
  beforeEach(() => resetMockEscrow())

  it('loads the overview and filters by status', async () => {
    const all = await escrowService.getOverview()
    expect(all.items).toHaveLength(6)
    expect(all.summary.platformFeePct).toBe(10)
    const refunded = await escrowService.getOverview('REFUNDED')
    expect(refunded.items.map((i) => i.status)).toEqual(['REFUNDED'])
  })

  it('creates a sandbox hold and walks it through capture and release', async () => {
    const hold = await escrowService.createTestBooking({
      restaurantId: 'rest1',
      minglerName: 'Zara Ali',
      guests: 2,
      amountPerGuest: 3000,
    })
    expect(hold).toMatchObject({ status: 'AUTHORIZED', amount: 6000, restaurantNet: 5400, platformFee: 600 })
    const captured = await escrowService.act(hold.id, 'capture')
    expect(captured.status).toBe('IN_ESCROW')
    const released = await escrowService.act(hold.id, 'release')
    expect(released.payout).toMatchObject({ amount: 5400, platformFee: 600 })
  })

  it('rejects invalid transitions, unknown restaurants and refunds without a reason', async () => {
    await expect(escrowService.act('esc-000101', 'capture')).rejects.toMatchObject({ status: 409 })
    await expect(escrowService.act('esc-000102', 'refund')).rejects.toBeInstanceOf(HttpError)
    await expect(escrowService.act('missing', 'capture')).rejects.toMatchObject({ status: 404 })
    await expect(
      escrowService.createTestBooking({ restaurantId: 'nope', minglerName: '', guests: 1, amountPerGuest: 100 }),
    ).rejects.toMatchObject({ status: 422 })
    const refunded = await escrowService.act('esc-000102', 'refund', 'Cancelled')
    expect(refunded.timeline.at(-1)).toMatchObject({ status: 'REFUNDED', note: 'Cancelled' })
  })
})

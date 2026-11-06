import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import * as antd from 'antd'
import { server } from '../../../../mocks/server'
import { renderWithProviders, makeQueryClient } from '../../../../test-utils/renderWithProviders'
import { LoyaltyPage } from '../LoyaltyPage'
import { loyaltyService } from '../services'

const SEED = {
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

function renderPage() {
  return renderWithProviders(<LoyaltyPage />, { queryClient: makeQueryClient() })
}

describe('LoyaltyPage', () => {
  let messageSpy: ReturnType<typeof vi.spyOn>
  let messageErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    messageSpy = vi
      .spyOn(antd.message, 'success')
      .mockImplementation((() => () => {}) as unknown as typeof antd.message.success)
    messageErrorSpy = vi
      .spyOn(antd.message, 'error')
      .mockImplementation((() => () => {}) as unknown as typeof antd.message.error)
    // Pin the GET handler to fresh seed data so PATCH side-effects from
    // previous tests (which mutate the shared mockLoyalty object) don't leak.
    server.use(
      http.get('/api/v1/loyalty-configuration', () =>
        HttpResponse.json({ success: true, data: { ...SEED } }),
      ),
    )
  })

  it('shows a loading spinner while GET is in flight', () => {
    server.use(http.get('/api/v1/loyalty-configuration', () => new Promise(() => {})))
    renderPage()
    expect(screen.queryByRole('heading', { name: /Earn rate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Redeem rate/i })).not.toBeInTheDocument()
  })

  it('shows an error alert when GET returns 500', async () => {
    server.use(
      http.get('/api/v1/loyalty-configuration', () =>
        HttpResponse.json({ message: 'server error' }, { status: 500 }),
      ),
    )
    renderPage()
    await screen.findByText(/Failed to load loyalty configuration/i)
  })

  it('pre-populates fields with seed values from API', async () => {
    renderPage()
    const inputs = await screen.findAllByRole('spinbutton')
    expect(inputs).toHaveLength(8)
    // Ant Design InputNumber renders value as a string in the DOM input element.
    expect(inputs[0]).toHaveValue('10') // pkrSpentToEarn1Point
    expect(inputs[1]).toHaveValue('100') // bonusPointsAt10thBooking
    expect(inputs[2]).toHaveValue('50') // pointsPerAcceptedInvite
    expect(inputs[3]).toHaveValue('25') // pointsPerReviewWithPhoto
    expect(inputs[4]).toHaveValue('75') // pointsPerCrownProminglerRole
    expect(inputs[5]).toHaveValue('15') // pointsPerInterestTableShare
    expect(inputs[6]).toHaveValue('100') // pointsNeededForPkr1Off
    expect(inputs[7]).toHaveValue('50') // maxRedemptionPercentOfBill
  })

  it('both Save buttons are disabled on initial load', async () => {
    renderPage()
    const earnBtn = await screen.findByRole('button', { name: /save earn rate/i })
    const redeemBtn = screen.getByRole('button', { name: /save redeem rate/i })
    expect(earnBtn).toBeDisabled()
    expect(redeemBtn).toBeDisabled()
  })

  it('changing an earn field enables Save earn rate and keeps Save redeem rate disabled', async () => {
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '20')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save earn rate/i })).not.toBeDisabled()
    })
    expect(screen.getByRole('button', { name: /save redeem rate/i })).toBeDisabled()
  })

  it('Save earn rate calls PATCH and shows toast, then button returns to disabled', async () => {
    const saveSpy = vi.spyOn(loyaltyService, 'saveEarnRate')
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '20')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save earn rate/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /save earn rate/i }))
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ pkrSpentToEarn1Point: 20 }))
    })
    expect(messageSpy).toHaveBeenCalledWith('Earn rate saved.')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save earn rate/i })).toBeDisabled(),
    )
    saveSpy.mockRestore()
  })

  it('Cancel reverts earn panel draft to server values (save button re-disables)', async () => {
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '20')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save earn rate/i })).not.toBeDisabled(),
    )
    const cancels = screen.getAllByRole('button', { name: /cancel/i })
    await user.click(cancels[0])
    // Draft resets to server value → dirty=false → save button disabled again.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save earn rate/i })).toBeDisabled(),
    )
  })

  it('changing a redeem field enables Save redeem rate and keeps Save earn rate disabled', async () => {
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[6])
    await user.type(inputs[6], '200')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save redeem rate/i })).not.toBeDisabled()
    })
    expect(screen.getByRole('button', { name: /save earn rate/i })).toBeDisabled()
  })

  it('Save redeem rate calls PATCH and shows toast, then button returns to disabled', async () => {
    const saveSpy = vi.spyOn(loyaltyService, 'saveRedeemRate')
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[6])
    await user.type(inputs[6], '200')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save redeem rate/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /save redeem rate/i }))
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(expect.objectContaining({ pointsNeededForPkr1Off: 200 }))
    })
    expect(messageSpy).toHaveBeenCalledWith('Redeem rate saved.')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save redeem rate/i })).toBeDisabled(),
    )
    saveSpy.mockRestore()
  })

  it('includes the crown-prominger and interest-table-share fields in the earn PATCH payload', async () => {
    const saveSpy = vi.spyOn(loyaltyService, 'saveEarnRate')
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[4])
    await user.type(inputs[4], '80')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save earn rate/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /save earn rate/i }))
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          pointsPerCrownProminglerRole: 80,
          pointsPerInterestTableShare: 15,
        }),
      )
    })
    saveSpy.mockRestore()
  })

  it('shows the backend error message as a toast when the earn-rate save fails', async () => {
    server.use(
      http.patch('/api/v1/loyalty-configuration/earn-rate', () =>
        HttpResponse.json({ error: { message: 'Earn rate is invalid' } }, { status: 400 }),
      ),
    )
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[0])
    await user.type(inputs[0], '20')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save earn rate/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /save earn rate/i }))
    await waitFor(() => {
      expect(messageErrorSpy).toHaveBeenCalledWith('Earn rate is invalid')
    })
    // Draft is preserved on failure, so the Save button stays enabled.
    expect(screen.getByRole('button', { name: /save earn rate/i })).not.toBeDisabled()
  })

  it('shows the backend error message as a toast when the redeem-rate save fails', async () => {
    server.use(
      http.patch('/api/v1/loyalty-configuration/redeem-rate', () =>
        HttpResponse.json({ error: { message: 'Redeem rate is invalid' } }, { status: 400 }),
      ),
    )
    renderPage()
    const user = userEvent.setup()
    const inputs = await screen.findAllByRole('spinbutton')
    await user.clear(inputs[6])
    await user.type(inputs[6], '200')
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save redeem rate/i })).not.toBeDisabled(),
    )
    await user.click(screen.getByRole('button', { name: /save redeem rate/i }))
    await waitFor(() => {
      expect(messageErrorSpy).toHaveBeenCalledWith('Redeem rate is invalid')
    })
  })
})

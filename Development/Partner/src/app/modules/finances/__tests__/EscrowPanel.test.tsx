import { beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import { server } from '../../../../mocks/server'
import { mockPartnerEscrow } from '../../../../mocks/handlers/partnerEscrow'
import { tokenStore } from '../../../../shared/auth/tokenStore'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { FINANCES_ENDPOINTS } from '../constants'
import { EscrowPanel } from '../components/EscrowPanel'
import { financesService } from '../services'

beforeEach(() => {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
})

describe('EscrowPanel', () => {
  it('shows the escrow balances, payout account and last payout', async () => {
    renderWithProviders(<EscrowPanel />)
    expect(await screen.findByRole('region', { name: 'Safepay escrow' })).toBeInTheDocument()
    expect(screen.getByText('Safepay · sandbox')).toBeInTheDocument()
    expect(screen.getByText('Held on cards')).toBeInTheDocument()
    expect(screen.getByText('After the 10% GoMingle fee')).toBeInTheDocument()
    expect(screen.getByText(/Payouts go to Meezan Bank PK40 •••• 6702/)).toBeInTheDocument()
    expect(screen.getByText(/Last payout PO-9F2C1A/)).toBeInTheDocument()
  })

  it('asks for a payout account when none is on file', async () => {
    server.use(
      http.get(FINANCES_ENDPOINTS.escrow, () =>
        HttpResponse.json({ success: true, data: { ...mockPartnerEscrow, payoutAccount: null, items: [] } }),
      ),
    )
    renderWithProviders(<EscrowPanel />)
    expect(await screen.findByText(/Add a payout bank account \(IBAN\)/)).toBeInTheDocument()
    expect(screen.queryByText(/Last payout/)).not.toBeInTheDocument()
  })

  it('shows a warning when the balance cannot be loaded', async () => {
    server.use(
      http.get(FINANCES_ENDPOINTS.escrow, () =>
        HttpResponse.json({ success: false, error: { code: 'ERR_VALIDATION', message: 'x' } }, { status: 422 }),
      ),
    )
    renderWithProviders(<EscrowPanel />)
    expect(await screen.findByText('Escrow balance could not be loaded.')).toBeInTheDocument()
  })

  it('reads the escrow overview through the finances service', async () => {
    const overview = await financesService.getEscrow()
    expect(overview.gateway.name).toBe('Safepay')
    expect(overview.summary.inEscrow).toBe(5600)
  })
})

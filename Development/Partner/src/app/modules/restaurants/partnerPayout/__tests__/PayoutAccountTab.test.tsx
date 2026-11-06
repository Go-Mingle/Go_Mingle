import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../../mocks/server'
import { setMockPayoutAccount } from '../../../../../mocks/handlers/partnerPayoutAccount'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { PAYOUT_ACCOUNT_ENDPOINT } from '../constants'
import { PayoutAccountTab } from '../components/PayoutAccountTab'

function setup() {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  const feedback = { showSuccess: vi.fn(), showError: vi.fn(), showErrorText: vi.fn() }
  const user = userEvent.setup()
  renderWithProviders(<PayoutAccountTab feedback={feedback} />)
  return { feedback, user }
}

async function chooseBank(user: ReturnType<typeof userEvent.setup>, bank: string) {
  await user.click(screen.getByRole('combobox'))
  await user.click(await screen.findByTitle(bank))
}

describe('PayoutAccountTab', () => {
  it('adds a payout account and then shows it masked', async () => {
    const { feedback, user } = setup()
    expect(await screen.findByText(/held in Safepay escrow/)).toBeInTheDocument()
    await user.type(screen.getByLabelText('Account title'), 'Kolachi Restaurant (Pvt) Ltd')
    await chooseBank(user, 'HBL')
    await user.type(screen.getByLabelText('IBAN'), 'pk72habb0012345678901234')
    await user.click(screen.getByRole('button', { name: 'Save payout account' }))

    expect(await screen.findByText('PK72 •••• 1234')).toBeInTheDocument()
    expect(screen.getByText('Kolachi Restaurant (Pvt) Ltd')).toBeInTheDocument()
    expect(screen.getByText('HBL')).toBeInTheDocument()
    expect(feedback.showSuccess).toHaveBeenCalledWith('Payout account saved.')
    expect(screen.queryByRole('button', { name: 'Save payout account' })).not.toBeInTheDocument()
  })

  it('validates the form before calling the API', async () => {
    const { user } = setup()
    await screen.findByLabelText('IBAN')
    await user.type(screen.getByLabelText('IBAN'), 'PK00HABB0000000000000000')
    await user.click(screen.getByRole('button', { name: 'Save payout account' }))
    expect(await screen.findByText('Enter the account title.')).toBeInTheDocument()
    expect(screen.getByText('Choose your bank.')).toBeInTheDocument()
    expect(screen.getByText(/Enter a valid Pakistani IBAN/)).toBeInTheDocument()
  })

  it('edits the title and bank while keeping the IBAN on file, and can cancel', async () => {
    setMockPayoutAccount({ accountTitle: 'Aurelia Dining', bankName: 'Meezan Bank', iban: 'PK40MEZN0000001123456702' })
    const { user } = setup()
    expect(await screen.findByText('PK40 •••• 6702')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit payout account' }))
    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Aurelia Dining')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Edit payout account' }))
    expect(screen.getByLabelText('IBAN')).toHaveValue('PK40 •••• 6702')
    expect(screen.getByText(/Leave as shown to keep/)).toBeInTheDocument()
    const title = screen.getByLabelText('Account title')
    await user.clear(title)
    await user.type(title, 'Aurelia Dining (Pvt) Ltd')
    await chooseBank(user, 'UBL')
    await user.click(screen.getByRole('button', { name: 'Save payout account' }))

    expect(await screen.findByText('Aurelia Dining (Pvt) Ltd')).toBeInTheDocument()
    expect(screen.getByText('UBL')).toBeInTheDocument()
    expect(screen.getByText('PK40 •••• 6702')).toBeInTheDocument()
  })

  it('shows a server field error under its input', async () => {
    server.use(
      http.put(PAYOUT_ACCOUNT_ENDPOINT, () =>
        HttpResponse.json(
          { success: false, error: { code: 'ERR_VALIDATION', message: 'That bank is not supported.', details: { field: 'bankName' } } },
          { status: 422 },
        ),
      ),
    )
    const { feedback, user } = setup()
    await user.type(await screen.findByLabelText('Account title'), 'Kolachi')
    await chooseBank(user, 'HBL')
    await user.type(screen.getByLabelText('IBAN'), 'PK72HABB0012345678901234')
    await user.click(screen.getByRole('button', { name: 'Save payout account' }))
    expect(await screen.findByText('That bank is not supported.')).toBeInTheDocument()
    expect(feedback.showError).not.toHaveBeenCalled()
  })

  it('sends other save failures to the toast channel', async () => {
    server.use(http.put(PAYOUT_ACCOUNT_ENDPOINT, () => HttpResponse.json({}, { status: 500 })))
    const { feedback, user } = setup()
    await user.type(await screen.findByLabelText('Account title'), 'Kolachi')
    await chooseBank(user, 'HBL')
    await user.type(screen.getByLabelText('IBAN'), 'PK72HABB0012345678901234')
    await user.click(screen.getByRole('button', { name: 'Save payout account' }))
    await waitFor(() => expect(feedback.showError).toHaveBeenCalled())
  })

  it('shows an error when the account cannot be loaded', async () => {
    server.use(
      http.get(PAYOUT_ACCOUNT_ENDPOINT, () =>
        HttpResponse.json({ success: false, error: { code: 'ERR_FORBIDDEN', message: 'Nope' } }, { status: 403 }),
      ),
    )
    setup()
    const alert = await screen.findByRole('alert')
    expect(within(alert).getByText(/Nope|could not be loaded/)).toBeInTheDocument()
  })
})

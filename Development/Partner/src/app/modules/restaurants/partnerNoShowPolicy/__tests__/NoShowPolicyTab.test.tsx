import { describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '../../../../../mocks/server'
import { mockNoShowPolicy, setMockNoShowPolicy } from '../../../../../mocks/handlers/partnerNoShowPolicy'
import { tokenStore } from '../../../../../shared/auth/tokenStore'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { NO_SHOW_POLICY_ENDPOINT } from '../constants'
import { NoShowPolicyTab } from '../components/NoShowPolicyTab'

function setup() {
  tokenStore.setTokens({ accessToken: 'access-1', refreshToken: 'r', expiresAt: 1 })
  const feedback = { showSuccess: vi.fn(), showError: vi.fn(), showErrorText: vi.fn() }
  const user = userEvent.setup()
  renderWithProviders(<NoShowPolicyTab feedback={feedback} />)
  return { feedback, user }
}

async function fill(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  const input = screen.getByLabelText(label)
  await user.clear(input)
  if (value) await user.type(input, value)
}

describe('NoShowPolicyTab', () => {
  it('shows the default policy: no penalty, 24 hours', async () => {
    setup()
    expect(await screen.findByText('No penalty')).toBeInTheDocument()
    expect(screen.getByText('Up to 24 hours before the table starts')).toBeInTheDocument()
    expect(screen.getByText(/Changes apply to new bookings only/)).toBeInTheDocument()
  })

  it('saves a penalty and a window, then shows them', async () => {
    const { feedback, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Edit no-show policy' }))
    await fill(user, 'Penalty per empty seat', '1500')
    await fill(user, 'Free cancellation window', '1')
    await user.click(screen.getByRole('button', { name: 'Save policy' }))

    expect(await screen.findByText('PKR 1,500 per seat')).toBeInTheDocument()
    expect(screen.getByText('Up to 1 hour before the table starts')).toBeInTheDocument()
    expect(feedback.showSuccess).toHaveBeenCalledWith('No-show policy saved.')
    expect(mockNoShowPolicy()).toMatchObject({ penaltyPerSeatPkr: 1500, cancellationWindowHours: 1 })
  })

  it('accepts a zero penalty', async () => {
    setMockNoShowPolicy({ penaltyPerSeatPkr: 2000, cancellationWindowHours: 12 })
    const { user } = setup()
    expect(await screen.findByText('PKR 2,000 per seat')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Edit no-show policy' }))
    await fill(user, 'Penalty per empty seat', '0')
    await user.click(screen.getByRole('button', { name: 'Save policy' }))
    expect(await screen.findByText('No penalty')).toBeInTheDocument()
  })

  it('asks for both values before calling the API, and can be cancelled', async () => {
    const { user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Edit no-show policy' }))
    await fill(user, 'Penalty per empty seat', '')
    await fill(user, 'Free cancellation window', '')
    await user.click(screen.getByRole('button', { name: 'Save policy' }))
    expect(await screen.findByText('Enter an amount of 0 or more.')).toBeInTheDocument()
    expect(screen.getByText('Enter a whole number of hours, 0 or more.')).toBeInTheDocument()
    expect(mockNoShowPolicy().penaltyPerSeatPkr).toBe(0)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('No penalty')).toBeInTheDocument()
  })

  it("shows the server's message under the field it refuses", async () => {
    server.use(
      http.put(NO_SHOW_POLICY_ENDPOINT, () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: 'ERR_VALIDATION',
              message: 'Please correct the highlighted fields.',
              details: { fields: { penaltyPerSeatPkr: 'The penalty can be at most PKR 100,000 per seat.' } },
            },
          },
          { status: 422 },
        ),
      ),
    )
    const { feedback, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Edit no-show policy' }))
    await user.click(screen.getByRole('button', { name: 'Save policy' }))
    expect(await screen.findByText('The penalty can be at most PKR 100,000 per seat.')).toBeInTheDocument()
    expect(feedback.showError).not.toHaveBeenCalled()
  })

  it('reports a failed save and a failed load', async () => {
    server.use(http.put(NO_SHOW_POLICY_ENDPOINT, () => HttpResponse.json({ success: false, error: { code: 'ERR_INTERNAL', message: 'Boom' } }, { status: 500 })))
    const { feedback, user } = setup()
    await user.click(await screen.findByRole('button', { name: 'Edit no-show policy' }))
    await user.click(screen.getByRole('button', { name: 'Save policy' }))
    await waitFor(() => expect(feedback.showError).toHaveBeenCalled())
  })

  it('shows an error when the policy cannot be loaded', async () => {
    server.use(http.get(NO_SHOW_POLICY_ENDPOINT, () => HttpResponse.json({ success: false, error: { code: 'ERR_INTERNAL', message: 'Could not load.' } }, { status: 500 })))
    setup()
    expect(await screen.findByText('Could not load.', {}, { timeout: 8000 })).toBeInTheDocument()
  })
})

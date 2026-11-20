import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { TimerSettingsPage } from '../TimerSettingsPage'
import { timerSettingsService } from '../services'

vi.mock('../services', () => ({ timerSettingsService: { getAll: vi.fn() } }))

describe('TimerSettingsPage', () => {
  it('shows every timer by group, with its value and who sets it', async () => {
    vi.mocked(timerSettingsService.getAll).mockResolvedValue([
      {
        key: 'auto-cancel',
        group: 'Bookings',
        name: 'Auto-cancel check',
        value: 4,
        unit: 'hours',
        appliesTo: 'A Pending table under 4 seats is cancelled.',
        source: 'PLATFORM_FIXED',
      },
      {
        key: 'cancellation-window',
        group: 'Bookings',
        name: "Restaurant's cancellation window",
        value: 24,
        unit: 'hours',
        appliesTo: 'Default.',
        source: 'PER_RESTAURANT',
      },
      {
        key: 'check-in-opens',
        group: 'Check-in',
        name: 'Check-in opens',
        value: 60,
        unit: 'minutes',
        appliesTo: 'From an hour before.',
        source: 'PLATFORM_FIXED',
      },
    ])
    renderWithProviders(<TimerSettingsPage />)
    expect(await screen.findByRole('heading', { name: 'Bookings' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Check-in' })).toBeInTheDocument()
    expect(screen.getByTestId('timer-auto-cancel')).toHaveTextContent('4 hours')
    expect(screen.getByTestId('timer-auto-cancel')).toHaveTextContent('Platform-fixed')
    expect(screen.getByTestId('timer-cancellation-window')).toHaveTextContent(
      'Set by each restaurant',
    )
    expect(screen.getByTestId('timer-check-in-opens')).toHaveTextContent('60 minutes')
  })
})

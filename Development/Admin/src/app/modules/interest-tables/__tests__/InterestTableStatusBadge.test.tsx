import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTableStatusBadge } from '../components/InterestTableStatusBadge'
import type { InterestTableStatus } from '../types'

describe('InterestTableStatusBadge', () => {
  const cases: [InterestTableStatus, string, string][] = [
    ['DRAFT', 'Draft', 'tint-neutral'],
    ['PENDING', 'Pending', 'warning'],
    ['COMING_SOON', 'Coming soon', 'tint-violet'],
    ['CONFIRMED', 'Confirmed', 'accent'],
    ['COMPLETED', 'Completed', 'success'],
    ['CANCELLED', 'Cancelled', 'error'],
  ]

  it.each(cases)('shows %s as a tinted %s pill', (status, label, tone) => {
    renderWithProviders(<InterestTableStatusBadge status={status} />)
    const badge = screen.getByText(label)
    expect(badge).toHaveAttribute('data-status', status)
    expect(badge.className).toContain(tone)
  })

  it('shows Completed in green, not blue', () => {
    renderWithProviders(<InterestTableStatusBadge status="COMPLETED" />)
    expect(screen.getByText('Completed').className).toContain('--color-success')
  })

  it('marks a confirmed table with a live dot', () => {
    const { container } = renderWithProviders(<InterestTableStatusBadge status="CONFIRMED" />)
    expect(container.querySelector('.gm-live-dot')).not.toBeNull()
  })

  it('explains the status on hover', async () => {
    renderWithProviders(<InterestTableStatusBadge status="PENDING" />)
    await userEvent.hover(screen.getByText('Pending'))
    expect(
      await screen.findByText('Published and waiting for enough bookings to go ahead.'),
    ).toBeInTheDocument()
  })

  it('uses the booking explanation for a booking', async () => {
    renderWithProviders(<InterestTableStatusBadge status="COMPLETED" kind="booking" />)
    await userEvent.hover(screen.getByText('Completed'))
    expect(await screen.findByText('Checked in. The dinner took place.')).toBeInTheDocument()
  })

  it('treats an unknown status as a draft', () => {
    renderWithProviders(<InterestTableStatusBadge status={'UNKNOWN' as InterestTableStatus} />)
    expect(screen.getByText('Draft')).toHaveAttribute('data-status', 'DRAFT')
  })
})

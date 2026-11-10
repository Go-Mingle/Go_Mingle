import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../app/atoms/StatusBadge'

describe('StatusBadge', () => {
  it('renders active badge with correct label', () => {
    render(<StatusBadge variant="active" />)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('renders pending badge', () => {
    render(<StatusBadge variant="pending" />)
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('renders suspended badge', () => {
    render(<StatusBadge variant="suspended" />)
    expect(screen.getByText('Suspended')).toBeTruthy()
  })

  it('renders deactivated badge', () => {
    render(<StatusBadge variant="deactivated" />)
    expect(screen.getByText('Deactivated')).toBeTruthy()
  })

  it('renders no-show badge', () => {
    render(<StatusBadge variant="no-show" />)
    expect(screen.getByText('No-show')).toBeTruthy()
  })

  it('renders completed badge', () => {
    render(<StatusBadge variant="completed" />)
    expect(screen.getByText('Completed')).toBeTruthy()
  })

  it('renders cancelled badge', () => {
    render(<StatusBadge variant="cancelled" />)
    expect(screen.getByText('Cancelled')).toBeTruthy()
  })

  it('renders upcoming badge', () => {
    render(<StatusBadge variant="upcoming" />)
    expect(screen.getByText('Upcoming')).toBeTruthy()
  })

  it('renders paid badge', () => {
    render(<StatusBadge variant="paid" />)
    expect(screen.getByText('Paid')).toBeTruthy()
  })

  it('renders verified badge with check icon', () => {
    render(<StatusBadge variant="verified" />)
    expect(screen.getByText('Verified')).toBeTruthy()
  })

  // Added for J6F's interest-table lifecycle and invite states, so the surface has
  // one badge component rather than a prototype fork with off-token colours.
  it.each([
    ['confirmed', 'Confirmed'],
    ['coming-soon', 'Coming Soon'],
    ['invited', 'Invited'],
    ['table-booked', 'Table Booked'],
  ] as const)('renders the %s badge', (variant, label) => {
    render(<StatusBadge variant={variant} />)
    expect(screen.getByText(label)).toBeTruthy()
  })

  it('renders an interest-table lifecycle state solid, and an invite state with a dot', () => {
    const { container: confirmed } = render(<StatusBadge variant="confirmed" />)
    // Solid variants fill the pill and carry no dot.
    expect(confirmed.querySelector('.bg-\\[var\\(--color-info\\)\\]')).toBeTruthy()
    expect(confirmed.querySelector('span.rounded-full')).toBeNull()

    const { container: invited } = render(<StatusBadge variant="invited" />)
    expect(invited.querySelector('span.rounded-full')).toBeTruthy()
  })
})

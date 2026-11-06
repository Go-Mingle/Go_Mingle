import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../app/atoms/StatusBadge'

describe('StatusBadge', () => {
  it('renders active badge with correct label', () => {
    render(<StatusBadge variant="ACTIVE" />)
    expect(screen.getByText('Active')).toBeTruthy()
  })

  it('renders pending badge', () => {
    render(<StatusBadge variant="PENDING" />)
    expect(screen.getByText('Pending')).toBeTruthy()
  })

  it('renders suspended badge', () => {
    render(<StatusBadge variant="SUSPENDED" />)
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
})

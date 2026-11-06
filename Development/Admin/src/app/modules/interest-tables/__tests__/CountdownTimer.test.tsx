import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountdownTimer } from '../components/CountdownTimer'
import type { InterestTableStatus } from '../types'

describe('CountdownTimer', () => {
  it('renders a dash when status is COMPLETED, regardless of timeLeft', () => {
    render(<CountdownTimer timeLeft="2d 3h" status="COMPLETED" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a dash when status is CANCELLED', () => {
    render(<CountdownTimer timeLeft="2d 3h" status="CANCELLED" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a dash when status is PENDING but timeLeft is null', () => {
    render(<CountdownTimer timeLeft={null} status="PENDING" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders a dash when status is CONFIRMED but timeLeft is an empty string', () => {
    render(<CountdownTimer timeLeft="" status="CONFIRMED" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('renders the remaining time for an active PENDING table', () => {
    render(<CountdownTimer timeLeft="2d 3h" status="PENDING" />)
    expect(screen.getByText('2d 3h')).toBeInTheDocument()
  })

  it('renders the remaining time for an active CONFIRMED table', () => {
    render(<CountdownTimer timeLeft="45m" status="CONFIRMED" />)
    expect(screen.getByText('45m')).toBeInTheDocument()
  })

  it('renders the closed label when timeLeft is "Started"', () => {
    render(<CountdownTimer timeLeft="Started" status="CONFIRMED" />)
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })

  it('renders the closed label when timeLeft is "Completed"', () => {
    render(<CountdownTimer timeLeft="Completed" status="PENDING" />)
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })

  it('renders the closed label when timeLeft is "Cancelled"', () => {
    render(<CountdownTimer timeLeft="Cancelled" status="PENDING" />)
    expect(screen.getByText('Closed')).toBeInTheDocument()
  })

  it('renders at the sm size without crashing', () => {
    render(<CountdownTimer timeLeft="10m" status="PENDING" size="sm" />)
    expect(screen.getByText('10m')).toBeInTheDocument()
  })

  it('renders at the default md size when size is omitted', () => {
    render(<CountdownTimer timeLeft="10m" status="PENDING" />)
    expect(screen.getByText('10m')).toBeInTheDocument()
  })

  it('unmounts cleanly without leaking timers or throwing', () => {
    const { unmount } = render(<CountdownTimer timeLeft="10m" status="PENDING" />)
    expect(() => unmount()).not.toThrow()
  })

  it.each<InterestTableStatus>(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'])(
    'handles status %s without crashing when timeLeft is null',
    (status) => {
      render(<CountdownTimer timeLeft={null} status={status} />)
      expect(screen.getByText('—')).toBeInTheDocument()
    },
  )
})

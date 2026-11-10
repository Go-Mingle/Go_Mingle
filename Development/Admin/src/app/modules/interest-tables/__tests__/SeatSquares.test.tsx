import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SeatSquares } from '../components/SeatSquares'

function getSquares(container: HTMLElement) {
  return Array.from(container.querySelectorAll('span'))
}

describe('SeatSquares', () => {
  it('renders one square per seat when total is below the cap', () => {
    const { container } = render(<SeatSquares booked={2} total={4} />)
    const squares = getSquares(container)
    expect(squares).toHaveLength(4)
  })

  it('fills the correct number of squares for booked seats', () => {
    const { container } = render(<SeatSquares booked={3} total={5} />)
    const squares = getSquares(container)
    expect(squares).toHaveLength(5)
    squares.forEach((square, i) => {
      if (i < 3) {
        expect(square).toHaveStyle({ background: 'var(--color-coral)' })
      } else {
        expect(square).toHaveStyle({ background: 'transparent' })
      }
    })
  })

  // [MET-1400] The cap was 6 (the V7 seat maximum). V8 allows Max Guests 4–8,
  // so a 7- or 8-seat table lost its last squares and read as full at 6/8.
  it('renders all 8 squares for a table at the V8 maximum', () => {
    const { container } = render(<SeatSquares booked={7} total={8} />)
    const squares = getSquares(container)
    expect(squares).toHaveLength(8)
    expect(squares[7]).toHaveStyle({ background: 'transparent' })
  })

  it('caps the number of rendered squares at 8 even when total is larger', () => {
    const { container } = render(<SeatSquares booked={10} total={12} />)
    const squares = getSquares(container)
    expect(squares).toHaveLength(8)
    // filled is capped at count (8) even though booked (10) exceeds it
    squares.forEach((square) => {
      expect(square).toHaveStyle({ background: 'var(--color-coral)' })
    })
  })

  it('renders no filled squares when booked is zero', () => {
    const { container } = render(<SeatSquares booked={0} total={3} />)
    const squares = getSquares(container)
    expect(squares).toHaveLength(3)
    squares.forEach((square) => {
      expect(square).toHaveStyle({ background: 'transparent' })
      // jsdom's CSSOM can't resolve var() inside the `border` shorthand (it
      // silently resets to the browser default), so assert the raw inline
      // style string instead of using toHaveStyle for this property.
      expect(square.getAttribute('style')).toContain('border: 1px solid var(--color-border-strong)')
    })
  })

  it('renders zero squares when total is zero', () => {
    const { container } = render(<SeatSquares booked={0} total={0} />)
    expect(getSquares(container)).toHaveLength(0)
  })
})

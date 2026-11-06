import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CountBadge } from '../CountBadge'

describe('CountBadge', () => {
  it('renders the count', () => {
    render(<CountBadge count={6} />)
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('renders the cap exactly at the cap', () => {
    render(<CountBadge count={99} />)
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('caps above the cap', () => {
    render(<CountBadge count={4213} />)

    expect(screen.getByText('99+')).toBeInTheDocument()
    expect(screen.queryByText('4213')).not.toBeInTheDocument()
  })

  it('honours a custom cap', () => {
    render(<CountBadge count={12} cap={9} />)
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  /**
   * Nothing at zero, not a `0` — the bell must read as an outline (BR-06). Rendering null
   * is also what lets callers pass a count unconditionally.
   */
  it.each([
    ['zero', 0],
    ['a negative count', -4],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
  ])('renders nothing for %s', (_label, count) => {
    const { container } = render(<CountBadge count={count} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('exposes the count to assistive tech when labelled', () => {
    render(<CountBadge count={3} label="3 unread notifications" />)
    expect(screen.getByLabelText('3 unread notifications')).toBeInTheDocument()
  })

  /** Bare digits are noise when the surrounding control already carries the meaning. */
  it('hides itself from assistive tech when unlabelled', () => {
    const { container } = render(<CountBadge count={3} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('pins itself to a corner when overlaid', () => {
    const { container } = render(<CountBadge count={3} placement="overlay" />)
    expect(container.firstElementChild?.className).toContain('absolute')
  })

  it('sits inline by default', () => {
    const { container } = render(<CountBadge count={3} />)
    expect(container.firstElementChild?.className).toContain('inline-flex')
  })
})

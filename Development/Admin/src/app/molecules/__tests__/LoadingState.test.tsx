import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingState } from '../LoadingState'

describe('LoadingState', () => {
  it('exposes a polite status role for assistive tech', () => {
    render(<LoadingState />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('renders the label when provided', () => {
    render(<LoadingState label="Loading…" />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('omits the label span when no label is given', () => {
    render(<LoadingState />)
    // Only the spinner is present — no extra label text node.
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument()
  })

  it('applies a custom class name and min-height', () => {
    render(<LoadingState className="my-loader" minHeight={300} />)
    const status = screen.getByRole('status')
    expect(status).toHaveClass('my-loader')
    expect(status).toHaveStyle({ minHeight: '300px' })
  })
})

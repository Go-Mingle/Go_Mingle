import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LoadingState } from '../LoadingState'

describe('LoadingState', () => {
  it('exposes a polite, busy status for assistive tech', () => {
    render(<LoadingState />)
    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(status).toHaveAttribute('aria-busy', 'true')
    expect(status).toHaveTextContent('Loading')
  })

  it('announces the label when provided', () => {
    render(<LoadingState label="Loading restaurant" />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading restaurant')
  })

  it('draws a detail outline by default and a table outline on request', () => {
    const { container, rerender } = render(<LoadingState />)
    const detailBars = container.querySelectorAll('.gm-skel').length
    rerender(<LoadingState variant="table" />)
    expect(container.querySelectorAll('.gm-skel').length).not.toBe(detailBars)
  })

  it('applies a custom class name', () => {
    render(<LoadingState className="my-loader" />)
    expect(screen.getByRole('status')).toHaveClass('my-loader', 'gm-skeleton')
  })
})

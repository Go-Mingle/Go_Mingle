import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StarRating } from '../StarRating'

/**
 * How many closed subpaths a star's shape has.
 *
 * Phosphor's solid star (`weight="fill"`) is one closed subpath; its outline star
 * (`weight="regular"`) closes twice — the outer boundary, then the inner cut-out. So
 * this counts the shape, not the colour, which is the distinction MET-1312 turned on:
 * every star already carried the rating colour, and an outline path painted amber is
 * still a hollow star on screen.
 */
function subpathCount(svg: Element): number {
  const d = svg.querySelector('path')?.getAttribute('d') ?? ''
  return (d.match(/[Zz]/g) ?? []).length
}

/** The stars that actually render solid. */
function solidStars(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('svg')].filter((svg) => subpathCount(svg) === 1)
}

/** The stars that render as an empty outline. */
function hollowStars(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('svg')].filter((svg) => subpathCount(svg) === 2)
}

function filledCount(container: HTMLElement): number {
  return solidStars(container).length
}

describe('StarRating', () => {
  it.each([0, 1, 3, 5])('always renders five stars for a rating of %i', (rating) => {
    const { container } = render(<StarRating rating={rating} />)
    expect(container.querySelectorAll('svg')).toHaveLength(5)
  })

  it.each([
    [0, 0],
    [1, 1],
    [3, 3],
    [5, 5],
  ])('fills %i of them for a rating of %i', (rating, expected) => {
    const { container } = render(<StarRating rating={rating} />)
    expect(filledCount(container)).toBe(expected)
  })

  it('rounds a fractional average', () => {
    const { container } = render(<StarRating rating={4.5} />)
    expect(filledCount(container)).toBe(5)
  })

  /** Clamped, so a malformed payload cannot light a sixth star or a negative one. */
  it('never fills more than five', () => {
    const { container } = render(<StarRating rating={9} />)
    expect(filledCount(container)).toBe(5)
  })

  it('never fills fewer than zero', () => {
    const { container } = render(<StarRating rating={-3} />)
    expect(filledCount(container)).toBe(0)
  })

  /**
   * MET-1312: a rating of 4 used to render five *outline* stars — the first four merely
   * tinted amber — so the column read as unrated at every rating. The remaining stars
   * must stay hollow, or the fix would just light all five.
   */
  it('renders the filled stars solid and the rest hollow', () => {
    const { container } = render(<StarRating rating={4} />)
    expect(solidStars(container)).toHaveLength(4)
    expect(hollowStars(container)).toHaveLength(1)
  })

  it('paints the filled stars with the rating colour and the empty ones muted', () => {
    const { container } = render(<StarRating rating={2} />)
    for (const svg of solidStars(container)) {
      expect(svg).toHaveAttribute('fill', 'var(--color-rating)')
    }
    for (const svg of hollowStars(container)) {
      expect(svg).toHaveAttribute('fill', 'var(--color-border-strong)')
    }
  })

  /** A colour alone cannot fill an outline path, so no star may be left shapeless. */
  it.each([0, 3, 5])('gives every star a resolved shape at a rating of %i', (rating) => {
    const { container } = render(<StarRating rating={rating} />)
    expect(solidStars(container).length + hollowStars(container).length).toBe(5)
  })

  it('respects the size prop', () => {
    const { container } = render(<StarRating rating={3} size={20} />)
    expect(container.querySelector('svg')).toHaveAttribute('width', '20')
  })

  /**
   * The stars carry the rating and no adjacent text repeats it, so without a label a
   * screen reader would announce nothing.
   */
  it('exposes the rating to assistive tech when labelled', () => {
    render(<StarRating rating={4} label="Rated 4 out of 5" />)
    expect(screen.getByRole('img', { name: 'Rated 4 out of 5' })).toBeInTheDocument()
  })

  it('hides itself from assistive tech when unlabelled, rather than announcing noise', () => {
    const { container } = render(<StarRating rating={4} />)
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

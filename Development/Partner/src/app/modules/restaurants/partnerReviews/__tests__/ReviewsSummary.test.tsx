import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { ReviewsSummary } from '../components/ReviewsSummary'
import type { ReviewsSummary as Summary } from '../types'

const SUMMARY: Summary = {
  average: 4,
  total: 8,
  distribution: { '5': 3, '4': 3, '3': 1, '2': 1, '1': 0 },
}

function percentOf(star: number): number {
  return Number(screen.getByTestId(`distribution-bar-${String(star)}`).dataset.percent)
}

/**
 * How many closed subpaths a star's shape has — 1 for Phosphor's solid star, 2 for the
 * outline weight (outer boundary plus the inner cut-out). Both star surfaces on this
 * block rendered as tinted outlines before MET-1312, which a colour assertion cannot
 * tell apart from a real fill.
 */
function subpathCount(svg: Element): number {
  const d = svg.querySelector('path')?.getAttribute('d') ?? ''
  return (d.match(/[Zz]/g) ?? []).length
}

describe('ReviewsSummary', () => {
  it('renders the average to one decimal', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)

    // `4` from the server must not render beside "4.5" as a bare "4".
    expect(screen.getByText('4.0')).toBeInTheDocument()
  })

  it('renders the all-time review count', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)
    expect(screen.getByText('8 reviews')).toBeInTheDocument()
  })

  it('uses the singular for one review', () => {
    renderWithProviders(
      <ReviewsSummary
        summary={{ average: 5, total: 1, distribution: { '5': 1, '4': 0, '3': 0, '2': 0, '1': 0 } }}
      />,
    )

    // Pluralised through i18n rather than a hardcoded `review{s}`.
    expect(screen.getByText('1 review')).toBeInTheDocument()
  })

  it('renders all five histogram rows, highest first', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)

    const bars = screen.getAllByTestId(/^distribution-bar-/)
    expect(bars).toHaveLength(5)
    expect(bars.map((bar) => bar.dataset.testid ?? bar.getAttribute('data-testid'))).toEqual([
      'distribution-bar-5',
      'distribution-bar-4',
      'distribution-bar-3',
      'distribution-bar-2',
      'distribution-bar-1',
    ])
  })

  it('sizes each bar against the all-time total', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)

    expect(percentOf(5)).toBe(38)
    expect(percentOf(3)).toBe(13)
  })

  /** All five keys always arrive, so a zero simply renders an empty bar. */
  it('renders a rating nobody gave as an empty bar rather than omitting the row', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)

    expect(screen.getByTestId('distribution-bar-1')).toBeInTheDocument()
    expect(percentOf(1)).toBe(0)
  })

  it('does not divide by zero on an empty summary', () => {
    renderWithProviders(
      <ReviewsSummary
        summary={{ average: 0, total: 0, distribution: { '5': 0, '4': 0, '3': 0, '2': 0, '1': 0 } }}
      />,
    )

    expect(screen.getByText('0.0')).toBeInTheDocument()
    expect(percentOf(5)).toBe(0)
  })

  it('exposes the average rating to assistive tech', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)
    expect(screen.getByRole('img', { name: 'Rated 4.0 out of 5' })).toBeInTheDocument()
  })

  it('fills as many of the average stars as the score (MET-1312)', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)

    const stars = screen.getByRole('img', { name: 'Rated 4.0 out of 5' })
    const solid = [...stars.querySelectorAll('svg')].filter((svg) => subpathCount(svg) === 1)
    expect(solid).toHaveLength(4)
  })

  it('renders each histogram row marker as a solid star', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)

    const markers = screen.getAllByRole('img', { name: /^\d star$/ })
    expect(markers).toHaveLength(5)
    for (const marker of markers) {
      expect(subpathCount(marker)).toBe(1)
    }
  })

  it('renders the counts alongside the bars', () => {
    renderWithProviders(<ReviewsSummary summary={SUMMARY} />)

    // Two ratings have a count of 3, one has 1 twice, and one has 0.
    expect(screen.getAllByText('3')).not.toHaveLength(0)
    expect(screen.getByText('0')).toBeInTheDocument()
  })
})

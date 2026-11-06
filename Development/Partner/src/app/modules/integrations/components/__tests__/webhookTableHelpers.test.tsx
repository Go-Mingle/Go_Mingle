import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { funnelIcon } from '../webhookTableHelpers'

const LABEL = 'Filter by status'

const renderIcon = (filtered: boolean) =>
  render(<>{funnelIcon(filtered, LABEL)}</>).container.querySelector('svg')

describe('funnelIcon', () => {
  it('renders in both filtered states', () => {
    expect(renderIcon(true)).toBeTruthy()
    expect(renderIcon(false)).toBeTruthy()
  })

  it('accents the icon only when a filter is active', () => {
    expect(renderIcon(true)?.getAttribute('class')).toContain('color-accent')
    expect(renderIcon(false)?.getAttribute('class')).toContain('color-text-subtle')
  })

  /**
   * The affordance regression that made this a "missing filter" bug: an unnamed
   * SVG is invisible to assistive tech and to anyone auditing the screen.
   */
  it('exposes the caller-supplied accessible name', () => {
    renderIcon(false)
    expect(screen.getByRole('img', { name: LABEL })).toBeInTheDocument()
  })
})

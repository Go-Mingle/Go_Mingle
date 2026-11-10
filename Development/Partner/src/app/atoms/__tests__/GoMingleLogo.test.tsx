import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { GoMingleLogo } from '../GoMingleLogo'

describe('GoMingleLogo', () => {
  it('renders the full logo by default with the default height', () => {
    renderWithProviders(<GoMingleLogo />)
    const img = screen.getByAltText('GoMingle')
    expect(img).toBeInTheDocument()
    expect(img).toHaveStyle({ '--logo-h': '36px' })
    expect(img).toHaveAttribute('draggable', 'false')
    expect(img.getAttribute('src')).toContain('gomingle-logo')
    expect(img.getAttribute('src')).not.toContain('light')
    expect(img.getAttribute('src')).not.toContain('mark')
  })

  it('renders the collapsed logo mark with height + 4 when collapsed', () => {
    renderWithProviders(<GoMingleLogo collapsed height={40} />)
    const img = screen.getByAltText('GoMingle')
    expect(img.getAttribute('src')).toContain('gomingle-mark')
    expect(img).toHaveStyle({ '--logo-h': '44px' })
  })

  it('renders the light wordmark lockup when light is set', () => {
    renderWithProviders(<GoMingleLogo light />)
    const img = screen.getByAltText('GoMingle')
    expect(img.getAttribute('src')).toContain('gomingle-logo-light')
  })

  it('honours a custom height on the full logo', () => {
    renderWithProviders(<GoMingleLogo height={50} />)
    const img = screen.getByAltText('GoMingle')
    expect(img).toHaveStyle({ '--logo-h': '50px' })
  })
})

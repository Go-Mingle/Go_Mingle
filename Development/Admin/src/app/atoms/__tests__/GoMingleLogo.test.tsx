import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { GoMingleLogo } from '../GoMingleLogo'

describe('GoMingleLogo', () => {
  it('renders img element with default props', () => {
    renderWithProviders(<GoMingleLogo />)
    expect(screen.getByRole('img', { name: /gomingle/i })).toBeInTheDocument()
  })

  it('renders the compact mark image when collapsed, distinct from the full logo', () => {
    const { unmount: unmountDefault } = renderWithProviders(<GoMingleLogo />)
    const defaultSrc = screen.getByRole('img', { name: /gomingle/i }).getAttribute('src')
    unmountDefault()

    renderWithProviders(<GoMingleLogo collapsed />)
    const collapsedSrc = screen.getByRole('img', { name: /gomingle/i }).getAttribute('src')
    expect(collapsedSrc).not.toBe(defaultSrc)
  })

  it('renders a distinct light wordmark image when light is true', () => {
    const { unmount: unmountDefault } = renderWithProviders(<GoMingleLogo />)
    const defaultSrc = screen.getByRole('img', { name: /gomingle/i }).getAttribute('src')
    unmountDefault()

    renderWithProviders(<GoMingleLogo light />)
    const lightSrc = screen.getByRole('img', { name: /gomingle/i }).getAttribute('src')
    expect(lightSrc).not.toBe(defaultSrc)
  })
})

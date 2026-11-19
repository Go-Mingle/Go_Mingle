import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { GoMingleLogo, GoMingleMark } from '../GoMingleLogo'

describe('GoMingleLogo', () => {
  it('renders the wordmark with the table mark as its O, named once for screen readers', () => {
    renderWithProviders(<GoMingleLogo />)
    const logo = screen.getByRole('img', { name: 'GoMingle' })
    expect(logo).toHaveStyle({ '--logo-h': '36px' })
    expect(logo).toHaveTextContent('GMingle')
    expect(logo.querySelector('svg.gm-mark')).not.toBeNull()
    expect(logo.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })

  it('draws five seated guests and one open seat', () => {
    const { container } = renderWithProviders(<GoMingleMark />)
    expect(container.querySelectorAll('.gm-mark__seat')).toHaveLength(5)
    expect(container.querySelectorAll('.gm-mark__open')).toHaveLength(1)
    expect(container.querySelectorAll('.gm-mark__table')).toHaveLength(1)
  })

  it('shows only the mark, 4px taller, when collapsed', () => {
    renderWithProviders(<GoMingleLogo collapsed height={40} />)
    const logo = screen.getByRole('img', { name: 'GoMingle' })
    expect(logo).not.toHaveTextContent('Mingle')
    expect(logo.querySelector('svg')).toHaveAttribute('width', '44')
  })

  it('uses the light lockup on dark backgrounds and animates only when asked', () => {
    const { container, rerender } = renderWithProviders(<GoMingleLogo light />)
    expect(container.querySelector('.gm-wordmark--light')).not.toBeNull()
    expect(container.querySelector('.gm-mark--light')).not.toBeNull()
    expect(container.querySelector('.gm-mark--animated')).toBeNull()
    rerender(<GoMingleLogo animated />)
    expect(container.querySelector('.gm-mark--animated')).not.toBeNull()
  })

  it('honours a custom height', () => {
    renderWithProviders(<GoMingleLogo height={50} />)
    expect(screen.getByRole('img', { name: 'GoMingle' })).toHaveStyle({ '--logo-h': '50px' })
  })
})

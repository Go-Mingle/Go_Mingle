import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { BrandPanel } from '../components/BrandPanel'

describe('BrandPanel (sign-in stage, option B)', () => {
  it('shows the logo and five guests plus one open seat gathering at the table', () => {
    const { container } = renderWithProviders(<BrandPanel />)
    expect(screen.getByRole('img', { name: 'GoMingle' })).toBeInTheDocument()
    expect(container.querySelectorAll('.gm-guest')).toHaveLength(6)
    expect(container.querySelectorAll('.gm-guest--open')).toHaveLength(1)
  })

  it('reads the whole headline to screen readers, not just the word on screen', () => {
    renderWithProviders(<BrandPanel />)
    const h1 = screen.getByRole('heading', { level: 1 })
    for (const w of ['Founders.', 'Poets.', 'Chess players.']) expect(h1).toHaveTextContent(w)
    expect(h1).toHaveTextContent('Tonight, at one table.')
  })
})

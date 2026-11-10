import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ImageWithFallback } from '../ImageWithFallback'

describe('ImageWithFallback', () => {
  it('renders the image when a src is given', () => {
    render(
      <ImageWithFallback src="https://cdn.test/a.png" alt="Aurelia" fallback={<span>AU</span>} />,
    )
    expect(screen.getByRole('img', { name: 'Aurelia' })).toHaveAttribute(
      'src',
      'https://cdn.test/a.png',
    )
    expect(screen.queryByText('AU')).not.toBeInTheDocument()
  })

  it('renders the fallback when there is no src', () => {
    render(<ImageWithFallback src={null} alt="Aurelia" fallback={<span>AU</span>} />)
    expect(screen.getByText('AU')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('swaps to the fallback when the image fails to load', () => {
    render(
      <ImageWithFallback
        src="https://cdn.test/broken.png"
        alt="Aurelia"
        fallback={<span>AU</span>}
      />,
    )
    fireEvent.error(screen.getByRole('img', { name: 'Aurelia' }))
    expect(screen.getByText('AU')).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

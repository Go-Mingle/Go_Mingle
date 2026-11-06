import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TableAvatar } from '../TableAvatar'

describe('TableAvatar', () => {
  it('renders the image when an imageUrl is provided', () => {
    render(<TableAvatar name="Jane Doe" imageUrl="https://example.com/a.png" />)
    const img = screen.getByRole('img', { name: 'Jane Doe' })
    expect(img).toHaveAttribute('src', 'https://example.com/a.png')
  })

  it('renders initials when no imageUrl is provided', () => {
    render(<TableAvatar name="Jane Doe" />)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('falls back to initials when the image fails to load', () => {
    render(<TableAvatar name="Jane Doe" imageUrl="https://example.com/broken.png" />)
    const img = screen.getByRole('img', { name: 'Jane Doe' })
    fireEvent.error(img)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('JD')).toBeInTheDocument()
  })

  it('renders a two-letter fallback for single-word names and ?? for empty', () => {
    const { rerender } = render(<TableAvatar name="Cafe" />)
    expect(screen.getByText('CA')).toBeInTheDocument()
    rerender(<TableAvatar name="" />)
    expect(screen.getByText('??')).toBeInTheDocument()
  })

  it('honours the rounded shape and a custom colour override', () => {
    render(<TableAvatar name="Table One" shape="rounded" color="#123456" size={40} />)
    const el = screen.getByText('TO')
    expect(el).toHaveStyle({ background: '#123456' })
  })

  it('applies an explicit radius to both the image and the initials fallback', () => {
    const { rerender } = render(
      <TableAvatar name="Table One" imageUrl="https://example.com/a.png" size={64} radius={12} />,
    )
    expect(screen.getByRole('img')).toHaveStyle({ borderRadius: '12px' })
    rerender(<TableAvatar name="Table One" size={64} radius={12} />)
    expect(screen.getByText('TO')).toHaveStyle({ borderRadius: '12px' })
  })
})

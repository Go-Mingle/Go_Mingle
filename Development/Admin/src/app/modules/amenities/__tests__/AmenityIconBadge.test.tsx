import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AmenityIconBadge } from '../components/AmenityIconBadge'

describe('AmenityIconBadge', () => {
  it('renders a CDN URL iconUrl as an <img> with that src', () => {
    const url = 'https://cdn.example.com/amenities/abc-123.svg'
    const { container } = render(<AmenityIconBadge iconUrl={url} />)
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img).toHaveAttribute('src', url)
  })

  it('appends the version cache-buster so a replaced icon is not served from cache', () => {
    const url = 'https://cdn.example.com/amenities/abc-123.svg'
    const { container } = render(<AmenityIconBadge iconUrl={url} version="2026-08-25T09:00:00Z" />)
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      `${url}?v=${encodeURIComponent('2026-08-25T09:00:00Z')}`,
    )
  })

  it('merges the cache-buster into an existing query string and keeps the hash', () => {
    const { container } = render(
      <AmenityIconBadge iconUrl="https://cdn.example.com/a.svg?w=32#icon" version={17} />,
    )
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/a.svg?w=32&v=17#icon',
    )
  })

  it('leaves the src untouched when no version is supplied', () => {
    const url = 'https://cdn.example.com/amenities/abc-123.svg'
    const { container } = render(<AmenityIconBadge iconUrl={url} version={null} />)
    expect(container.querySelector('img')).toHaveAttribute('src', url)
  })

  it('renders the built-in shield icon (no <img>) when iconUrl is null', () => {
    const { container } = render(<AmenityIconBadge iconUrl={null} />)
    expect(container.querySelector('img')).toBeNull()
    // Phosphor renders an <svg>; the current UI is preserved for null icons.
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders a Phosphor icon (no <img>) for a known icon name', () => {
    const { container } = render(<AmenityIconBadge iconUrl="WifiHigh" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('renders sanitized inline SVG markup (no <img>)', () => {
    const { container } = render(
      <AmenityIconBadge iconUrl='<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>' />,
    )
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

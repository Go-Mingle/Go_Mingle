import { describe, it, expect } from 'vitest'
import { authLinkClass } from '../components/authStyles'

describe('authLinkClass', () => {
  it('includes the teal accent link base classes', () => {
    expect(authLinkClass(false)).toContain('text-[var(--color-accent)]')
    expect(authLinkClass(false)).toContain('transition-colors')
  })

  it('adds hover:underline on desktop (not mobile)', () => {
    expect(authLinkClass(false)).toContain('hover:underline')
  })

  it('drops hover:underline on mobile', () => {
    expect(authLinkClass(true)).not.toContain('hover:underline')
  })
})

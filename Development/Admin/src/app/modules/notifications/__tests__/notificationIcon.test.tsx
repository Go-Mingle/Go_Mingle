import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { notificationIcon, notificationIconBgClass } from '../notificationIcon'

describe('notificationIcon', () => {
  it('renders an svg for every known type and the fallback', () => {
    const types = [
      'RESTAURANT_APPLICATION_SUBMITTED',
      'RESTAURANT_APPROVED',
      'RESTAURANT_REJECTED',
      'RESTAURANT_SUSPENDED',
      'RESTAURANT_UNSUSPENDED',
      'MINGLER_SUSPENDED',
      'MINGLER_UNSUSPENDED',
      'TOTALLY_UNKNOWN',
    ]
    for (const type of types) {
      const { container } = render(<div>{notificationIcon(type)}</div>)
      expect(container.querySelector('svg')).toBeInTheDocument()
    }
  })

  it('respects a custom size', () => {
    const { container } = render(<div>{notificationIcon('RESTAURANT_APPROVED', 16)}</div>)
    expect(container.querySelector('svg')).toHaveAttribute('width', '16')
  })
})

describe('notificationIconBgClass', () => {
  it('maps suspension and unsuspension to distinct backgrounds', () => {
    expect(notificationIconBgClass('RESTAURANT_SUSPENDED')).toBe('bg-[var(--color-error-bg)]')
    expect(notificationIconBgClass('RESTAURANT_UNSUSPENDED')).toBe('bg-[var(--color-success-bg)]')
  })

  it('maps rejected to the error background and approved to success', () => {
    expect(notificationIconBgClass('RESTAURANT_REJECTED')).toBe('bg-[var(--color-error-bg)]')
    expect(notificationIconBgClass('RESTAURANT_APPROVED')).toBe('bg-[var(--color-success-bg)]')
  })

  it('maps application to the accent background', () => {
    expect(notificationIconBgClass('RESTAURANT_APPLICATION_SUBMITTED')).toBe(
      'bg-[var(--color-accent-light)]',
    )
  })

  it('maps mingler events to the accent background', () => {
    expect(notificationIconBgClass('MINGLER_UNSUSPENDED')).toBe('bg-[var(--color-success-bg)]')
    expect(notificationIconBgClass('MINGLER_SUSPENDED')).toBe('bg-[var(--color-error-bg)]')
  })

  it('falls back to the neutral divider background for unknown types', () => {
    expect(notificationIconBgClass('WHATEVER')).toBe('bg-[var(--color-divider)]')
  })
})

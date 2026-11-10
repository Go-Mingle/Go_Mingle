import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RestaurantDetailHeader } from '../components/RestaurantDetailHeader'

function setViewport(mobile: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((q: string) => ({
      matches: !mobile && /min-width/.test(q),
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const baseProps = {
  restaurant: { id: 'r1', name: 'Aurelia', cuisine: 'Italian', areaDistrict: 'Marina' } as Record<
    string,
    unknown
  >,
  platformStatusStyle: { bg: '#000', text: '#fff', label: 'Active' },
  visibilityStyle: { bg: '#000', text: '#fff', label: 'Visible' },
  onChangeCategoryClick: vi.fn(),
  onSuspend: vi.fn(),
  onReactivate: vi.fn(),
}

describe('RestaurantDetailHeader', () => {
  it('renders default actions with Suspend for an active restaurant (desktop)', () => {
    setViewport(false)
    renderWithProviders(<RestaurantDetailHeader {...baseProps} isActive />)
    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /suspend/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change category/i })).toBeInTheDocument()
  })

  it('renders Unsuspend when the restaurant is not active', () => {
    setViewport(false)
    renderWithProviders(<RestaurantDetailHeader {...baseProps} isActive={false} />)
    expect(screen.getByRole('button', { name: /unsuspend/i })).toBeInTheDocument()
  })

  it('disables Change Category when the restaurant is suspended', () => {
    setViewport(false)
    renderWithProviders(<RestaurantDetailHeader {...baseProps} isActive={false} isSuspended />)
    expect(screen.getByRole('button', { name: /change category/i })).toBeDisabled()
  })

  it('keeps Change Category enabled when not suspended', () => {
    setViewport(false)
    renderWithProviders(<RestaurantDetailHeader {...baseProps} isActive />)
    expect(screen.getByRole('button', { name: /change category/i })).toBeEnabled()
  })

  it('shows the "Back to approval queue" label when opened under /approval-queue', () => {
    setViewport(false)
    renderWithProviders(<RestaurantDetailHeader {...baseProps} isActive />, {
      route: '/approval-queue/r1',
    })
    expect(screen.getByText('Back to approval queue')).toBeInTheDocument()
  })

  it('shows the "Back to restaurants" label on the restaurants route', () => {
    setViewport(false)
    renderWithProviders(<RestaurantDetailHeader {...baseProps} isActive />, {
      route: '/restaurants/r1',
    })
    expect(screen.getByText('Back to restaurants')).toBeInTheDocument()
  })

  it('renders a custom actions slot instead of the defaults (mobile layout)', () => {
    setViewport(true)
    renderWithProviders(
      <RestaurantDetailHeader
        {...baseProps}
        isActive
        actions={<button type="button">Approve</button>}
      />,
    )
    expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change category/i })).not.toBeInTheDocument()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { ProfileHeader } from '../components/ProfileHeader'
import type { PartnerRestaurantProfile, RestaurantProfileStatus } from '../types'

function makeProfile(over: Partial<PartnerRestaurantProfile> = {}): PartnerRestaurantProfile {
  return {
    status: 'DRAFT' as RestaurantProfileStatus,
    editable: true,
    name: 'Aurelia',
    coverPhotoUrl: null,
    visibleOnApp: false,
    location: { areaDistrict: 'Downtown', city: 'Karachi' },
    submissionReadiness: { canSubmit: true },
    ...over,
  } as unknown as PartnerRestaurantProfile
}

function renderHeader(over: Partial<PartnerRestaurantProfile> = {}) {
  const handlers = {
    onEditName: vi.fn(),
    onOpenImage: vi.fn(),
    onOpenPayments: vi.fn(),
    onToggleVisibility: vi.fn(),
    onSubmit: vi.fn(),
  }
  renderWithProviders(
    <ProfileHeader
      profile={makeProfile(over)}
      {...handlers}
      submitting={false}
      saving={false}
      launchingPayments={false}
    />,
  )
  return handlers
}

describe('ProfileHeader', () => {
  /**
   * Deliberately absent. BR-04 persists every card as it is saved, so the button
   * only ever re-sent an empty body and toasted — a divergence from AC-01.2 that
   * the spec is expected to absorb. Pinned so it cannot creep back unnoticed.
   */
  it('offers no Save as Draft action in Draft', () => {
    renderHeader({ status: 'DRAFT', editable: true })
    expect(screen.queryByRole('button', { name: /Save as Draft/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send for Approval/i })).toBeInTheDocument()
  })

  it('renders the setup-state header and fires every action handler', () => {
    const h = renderHeader()

    expect(screen.getByText('Aurelia')).toBeInTheDocument()
    expect(screen.getByText('Draft')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Restaurant image' }))
    expect(h.onOpenImage).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: 'Edit restaurant name and location' }))
    expect(h.onEditName).toHaveBeenCalledOnce()

    // No payout account yet, so the button invites adding one.
    fireEvent.click(screen.getByRole('button', { name: /Add Payout Account/i }))
    expect(h.onOpenPayments).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole('button', { name: /Send for Approval/i }))
    expect(h.onSubmit).toHaveBeenCalledOnce()
  })

  it('shows the muted name placeholder when the restaurant has no name yet', () => {
    renderHeader({ name: null } as Partial<PartnerRestaurantProfile>)
    expect(screen.getByText('Add your restaurant name')).toBeInTheDocument()
  })

  it('disables Send for Approval until the profile can be submitted', () => {
    renderHeader({
      submissionReadiness: { canSubmit: false },
    } as Partial<PartnerRestaurantProfile>)
    expect(screen.getByRole('button', { name: /Send for Approval/i })).toBeDisabled()
  })

  it('shows the visibility toggle (not the setup actions) when Active', () => {
    const h = renderHeader({
      status: 'ACTIVE' as RestaurantProfileStatus,
      visibleOnApp: true,
      submissionReadiness: { canSubmit: true, payoutConfigured: true },
    } as Partial<PartnerRestaurantProfile>)

    const toggle = screen.getByRole('switch')
    fireEvent.click(toggle)
    expect(h.onToggleVisibility).toHaveBeenCalled()

    expect(screen.queryByRole('button', { name: /Save as Draft/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Send for Approval/i })).not.toBeInTheDocument()
    // Payments stays available wherever the profile is editable.
    expect(screen.getByRole('button', { name: /^Payout Account$/i })).toBeInTheDocument()
  })

  it('hides editing affordances when the profile is not editable', () => {
    renderHeader({
      status: 'PENDING' as RestaurantProfileStatus,
      editable: false,
    } as Partial<PartnerRestaurantProfile>)

    expect(
      screen.queryByRole('button', { name: 'Edit restaurant name and location' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Payout Account/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save as Draft/i })).not.toBeInTheDocument()
  })
})

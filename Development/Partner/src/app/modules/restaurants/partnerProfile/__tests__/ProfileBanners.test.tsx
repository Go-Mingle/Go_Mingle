import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { ProfileBanners } from '../components/ProfileBanners'
import type { SubmissionReadiness } from '../types'

const notReady: SubmissionReadiness = {
  missingFields: ['ownerName', 'restaurantPhone'],
  payoutConfigured: true,
  hasCoverPhoto: false,
  canSubmit: false,
}

describe('ProfileBanners readiness checklist', () => {
  it('lists what is missing on a draft before any submit', () => {
    renderWithProviders(
      <ProfileBanners status="DRAFT" rejections={[]} blockers={null} readiness={notReady} />,
    )
    const box = screen.getByRole('status')
    expect(box).toHaveTextContent('Before you can send for approval')
    expect(box).toHaveTextContent('Owner Name, Restaurant Phone')
    expect(box).toHaveTextContent(/Add a cover photo/)
    expect(box).not.toHaveTextContent(/payout bank account/)
  })

  it('names a missing payout account', () => {
    renderWithProviders(
      <ProfileBanners
        status="REJECTED"
        rejections={[]}
        blockers={null}
        readiness={{ missingFields: [], payoutConfigured: false, hasCoverPhoto: true, canSubmit: false }}
      />,
    )
    expect(screen.getByRole('status')).toHaveTextContent(/Add your payout bank account on the Payout Account tab/)
  })

  it('shows nothing extra when the draft is ready', () => {
    renderWithProviders(
      <ProfileBanners
        status="DRAFT"
        rejections={[]}
        blockers={null}
        readiness={{ ...notReady, missingFields: [], hasCoverPhoto: true, canSubmit: true }}
      />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('does not show the checklist while under review', () => {
    renderWithProviders(
      <ProfileBanners status="PENDING" rejections={[]} blockers={null} readiness={notReady} />,
    )
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('prefers the blockers from a failed submit', () => {
    renderWithProviders(
      <ProfileBanners
        status="DRAFT"
        rejections={[]}
        blockers={{ needsPayout: true }}
        readiness={notReady}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent("Your application can't be submitted yet")
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})

import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTableDetailTabs } from '../components/InterestTableDetailTabs'
import type { InterestTable } from '../types'

function makeTable(over: Partial<InterestTable> = {}): InterestTable {
  return {
    id: 'it1',
    name: 'Founders Dinner',
    topic: null,
    assignedTable: null,
    restaurant: { id: 'r1', name: 'Aurelia' },
    seatsBooked: 0,
    minMinglers: 4,
    maxMinglers: 6,
    startDate: '2026-08-20',
    startTime: '19:00',
    durationHours: 2,
    sponsorName: null,
    sponsorLogoUrl: null,
    eventImageUrl: null,
    timeLeft: '2d',
    status: 'PENDING',
    created: '2026-07-01T00:00:00Z',
    inviteOnly: true,
    ...over,
  }
}

const baseProps = {
  table: makeTable(),
  bookings: [],
  menuOptions: [],
  activeTab: 'overview',
  onTabChange: () => {},
  minglers: [],
}

function tab(name: RegExp) {
  return screen.queryByRole('tab', { name })
}

describe('InterestTableDetailTabs — RBAC gating', () => {
  it('shows Bookings and Invited tabs with full access', () => {
    renderWithProviders(
      <InterestTableDetailTabs {...baseProps} hasBookingsAccess hasMinglerAccess />,
    )
    expect(tab(/bookings/i)).toBeInTheDocument()
    expect(tab(/invited/i)).toBeInTheDocument()
  })

  it('hides the Bookings tab without BOOKINGS access', () => {
    renderWithProviders(
      <InterestTableDetailTabs {...baseProps} hasBookingsAccess={false} hasMinglerAccess />,
    )
    expect(tab(/bookings/i)).not.toBeInTheDocument()
    expect(tab(/invited/i)).toBeInTheDocument()
  })

  it('hides the Invited tab without MANAGE_MINGLERS access', () => {
    renderWithProviders(
      <InterestTableDetailTabs {...baseProps} hasBookingsAccess hasMinglerAccess={false} />,
    )
    expect(tab(/bookings/i)).toBeInTheDocument()
    expect(tab(/invited/i)).not.toBeInTheDocument()
  })

  it('never shows the Invited tab when the table is not invite-only', () => {
    renderWithProviders(
      <InterestTableDetailTabs
        {...baseProps}
        table={makeTable({ inviteOnly: false })}
        hasBookingsAccess
        hasMinglerAccess
      />,
    )
    expect(tab(/invited/i)).not.toBeInTheDocument()
  })
})

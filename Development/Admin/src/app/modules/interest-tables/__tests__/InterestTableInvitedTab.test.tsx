import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTableInvitedTab, type InviteeMingler } from '../components/InterestTableInvitedTab'
import type { InterestTable } from '../types'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function setMobile() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: /max-width/.test(query),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

const minglers: InviteeMingler[] = [
  { id: 'g1', name: 'Guest One', phone: '111' },
  { id: 'g2', name: 'Guest Two', phone: '222' },
]

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
    inviteList: ['g1'],
    promingler: { id: 'p1', name: 'Bob' },
    ...over,
  }
}

describe('InterestTableInvitedTab', () => {
  it('renders the promingler and invited rows, resolving names from minglers', () => {
    renderWithProviders(
      <InterestTableInvitedTab table={makeTable()} bookings={[]} minglers={minglers} />,
    )
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.getByText('Guest One')).toBeInTheDocument()
  })

  it('shows the empty state when there are no invitees or promingler', () => {
    renderWithProviders(
      <InterestTableInvitedTab
        table={makeTable({ inviteList: [], promingler: undefined })}
        bookings={[]}
        minglers={minglers}
      />,
    )
    expect(screen.getByText('No minglers invited yet.')).toBeInTheDocument()
  })

  it('adds selected invitees via onAddInvitee', async () => {
    const onAddInvitee = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <InterestTableInvitedTab
        table={makeTable()}
        bookings={[]}
        minglers={minglers}
        onAddInvitee={onAddInvitee}
      />,
    )
    // g2 is not yet in the list → available to add.
    fireEvent.mouseDown(screen.getByText('Select minglers to invite'))
    await user.click(await screen.findByText('Guest Two — 222'))
    await user.click(screen.getByRole('button', { name: /add/i }))
    expect(onAddInvitee).toHaveBeenCalledWith(['g2'])
  })

  it('cancels an invite via the confirm modal → onRemoveInvitee', async () => {
    const onRemoveInvitee = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <InterestTableInvitedTab
        table={makeTable()}
        bookings={[]}
        minglers={minglers}
        onRemoveInvitee={onRemoveInvitee}
      />,
    )
    const row = screen.getByText('Guest One').closest('tr') as HTMLElement
    fireEvent.click(row.querySelector('td:last-child svg') as SVGElement)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel invite' }))
    expect(onRemoveInvitee).toHaveBeenCalledWith('g1')
  })

  it('navigates to the mingler profile when a name is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <InterestTableInvitedTab table={makeTable()} bookings={[]} minglers={minglers} />,
    )
    await user.click(screen.getByText('Guest One'))
    expect(mockNavigate).toHaveBeenCalledWith('/minglers/g1', {
      state: { backLabel: 'Back to interest table' },
    })
  })

  it('renders a mobile card list instead of the data table on small viewports', () => {
    setMobile()
    renderWithProviders(
      <InterestTableInvitedTab
        table={makeTable()}
        bookings={[]}
        minglers={minglers}
        onRemoveInvitee={vi.fn()}
      />,
    )
    expect(screen.getByText('Guest One')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('marks a mingler with an active booking as joined (no cancel action)', () => {
    renderWithProviders(
      <InterestTableInvitedTab
        table={makeTable()}
        bookings={[
          {
            id: 'b1',
            bookingId: 'BK-1',
            minglerId: 'g1',
            guest: 'Guest One',
            date: '2026-08-20',
            interestTableId: 'it1',
            interestTableTopic: 'x',
            comboId: '',
            comboName: '',
            status: 'CONFIRMED',
            bill: 0,
          },
        ]}
        minglers={minglers}
        onRemoveInvitee={vi.fn()}
      />,
    )
    expect(screen.getByText('Table Booked')).toBeInTheDocument()
  })
})

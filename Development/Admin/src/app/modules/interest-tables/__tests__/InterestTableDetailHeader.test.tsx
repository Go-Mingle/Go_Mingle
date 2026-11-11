import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestTableDetailHeader } from '../components/InterestTableDetailHeader'
import type { InterestTable } from '../types'

const mockNavigate = vi.fn()
let mockLocationState: unknown = null
// `rid` is only present on the restaurant-scoped detail route; the global
// master list uses /interest-tables/:id, where it is absent.
let mockParams: Record<string, string | undefined> = { rid: 'r1', id: 'it1' }
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
    useLocation: () => ({
      state: mockLocationState,
      pathname: '/',
      search: '',
      hash: '',
      key: 'k',
    }),
  }
})

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
    status: 'DRAFT',
    created: '2026-07-01T00:00:00Z',
    ...over,
  }
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockLocationState = null
  mockParams = { rid: 'r1', id: 'it1' }
})

afterEach(() => {
  // The copy-link test fires an antd toast whose auto-dismiss timer would
  // otherwise fire after this file's jsdom teardown, surfacing a
  // "ReferenceError: window is not defined" from React's scheduler. Destroying
  // the message queue synchronously clears that pending timer/render.
  message.destroy()
})

describe('InterestTableDetailHeader', () => {
  it('copies a shareable link and shows a toast', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InterestTableDetailHeader table={makeTable()} />)
    await user.click(screen.getByRole('button', { name: /copy link/i }))
    // navigator.clipboard is optional-chained in the component; the toast proves it ran.
    expect(await screen.findByText('Link copied to clipboard')).toBeInTheDocument()
  })

  it('navigates back to the restaurant interest-tables tab when the route is restaurant-scoped', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InterestTableDetailHeader table={makeTable()} />)
    await user.click(screen.getByText('Back to interest tables'))
    expect(mockNavigate).toHaveBeenCalledWith('/restaurants/r1?tab=interest-tables')
  })

  it('navigates back to the global master list when the route has no :rid', async () => {
    mockParams = { id: 'it1' }
    const user = userEvent.setup()
    renderWithProviders(<InterestTableDetailHeader table={makeTable()} />)
    await user.click(screen.getByText('Back to interest tables'))
    expect(mockNavigate).toHaveBeenCalledWith('/interest-tables')
  })

  it('uses history back + the provided back label when arriving with location state', async () => {
    mockLocationState = { backLabel: 'Back to approval queue' }
    const user = userEvent.setup()
    renderWithProviders(<InterestTableDetailHeader table={makeTable()} />)
    await user.click(screen.getByText('Back to approval queue'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  // Deleting an interest table is disabled portal-wide — the button still
  // renders (so the action stays discoverable) but can never be clicked.
  it('asks before deleting, then deletes', async () => {
    const onDelete = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<InterestTableDetailHeader table={makeTable()} onDelete={onDelete} />)

    const deleteBtn = screen.getByRole('button', { name: /delete/i })
    expect(deleteBtn).toBeEnabled()
    await user.click(deleteBtn)
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete this interest table?')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledTimes(1)
  })

  it('offers Edit on a live table and not on a finished one', () => {
    const onEdit = vi.fn()
    const { unmount } = renderWithProviders(
      <InterestTableDetailHeader table={makeTable({ status: 'PENDING' })} onEdit={onEdit} />,
    )
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
    unmount()
    renderWithProviders(<InterestTableDetailHeader table={makeTable({ status: 'COMPLETED' })} onEdit={onEdit} />)
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('shows the table initials when there is no cover image', () => {
    renderWithProviders(
      <InterestTableDetailHeader table={makeTable({ name: 'Founders Dinner' })} />,
    )
    // No coverImage/eventImageUrl → initials fallback, no <img>.
    expect(document.querySelector('img')).toBeNull()
    expect(screen.getByText('FD')).toBeInTheDocument()
  })

  // MET-1309 — `created` arrives as 'DD-MM-YYYY HH:mm' from the real API, which
  // a plain dayjs() parse rendered as "Created Invalid Date".
  it('renders the created date for the real API "DD-MM-YYYY HH:mm" shape', () => {
    renderWithProviders(
      <InterestTableDetailHeader table={makeTable({ created: '16-07-2026 15:44' })} />,
    )
    expect(screen.getByText('Created 16 Jul 2026')).toBeInTheDocument()
    expect(screen.queryByText(/Invalid Date/i)).toBeNull()
  })

  it('renders the created date for an ISO timestamp', () => {
    renderWithProviders(
      <InterestTableDetailHeader table={makeTable({ created: '2026-07-01T00:00:00' })} />,
    )
    expect(screen.getByText('Created 01 Jul 2026')).toBeInTheDocument()
  })

  it('omits the created line entirely when the timestamp is missing or unparseable', () => {
    renderWithProviders(<InterestTableDetailHeader table={makeTable({ created: '' })} />)
    expect(screen.queryByText(/^Created /)).toBeNull()
    expect(screen.queryByText(/Invalid Date/i)).toBeNull()
  })

  it('renders the cover image when one is present', () => {
    renderWithProviders(
      <InterestTableDetailHeader
        table={makeTable({ coverImage: 'https://cdn.example.com/cover.jpg' })}
      />,
    )
    expect(document.querySelector('img')).toHaveAttribute(
      'src',
      'https://cdn.example.com/cover.jpg',
    )
  })
})

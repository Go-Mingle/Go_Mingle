import { describe, it, expect, vi, afterEach } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { TableTimingsTab } from '../components/TableTimingsTab'
import { emptyAvailability, emptyWeekDraft } from '../format'
import type { useTableTimingsTab } from '../hooks/useTableTimingsTab'
import type { PartnerTable, TableAvailability } from '../types'

type Controller = ReturnType<typeof useTableTimingsTab>

function availability(open: Partial<TableAvailability> = {}): TableAvailability {
  return { ...emptyAvailability(), ...open }
}

const VISIBLE: PartnerTable = {
  tableId: 't1',
  name: 'Window Table',
  isHidden: false,
  availability: availability({
    '1': [
      { start: '10:00', end: '11:00' },
      { start: '16:00', end: '17:00' },
    ],
    '3': [{ start: '16:00', end: '19:00' }],
  }),
}

const HIDDEN: PartnerTable = {
  tableId: 't3',
  name: "Chef's Counter",
  isHidden: true,
  availability: availability({ '5': [{ start: '20:00', end: '23:00' }] }),
}

function controller(overrides: Partial<Controller> = {}): Controller {
  return {
    tables: [VISIBLE, HIDDEN],
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    editable: true,

    formOpen: false,
    editing: null,
    draft: { name: '', days: emptyWeekDraft() },
    errors: {},
    openAdd: vi.fn(),
    openEdit: vi.fn(),
    closeForm: vi.fn(),
    setName: vi.fn(),
    toggleDay: vi.fn(),
    setRange: vi.fn(),
    addRange: vi.fn(),
    removeRange: vi.fn(),
    submit: vi.fn(),
    saving: false,

    visibilityTarget: null,
    requestVisibility: vi.fn(),
    cancelVisibility: vi.fn(),
    confirmVisibility: vi.fn(),
    togglingVisibility: false,

    deleteTarget: null,
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    deleting: false,

    blocked: null,
    dismissBlocked: vi.fn(),
    hideFromBlocked: vi.fn(),
    ...overrides,
  } as Controller
}

function renderTab(overrides: Partial<Controller> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<TableTimingsTab c={c} />) }
}

const cardFor = (name: string) =>
  screen.getByText(name).closest('div.rounded-\\[var\\(--radius-lg\\)\\]') as HTMLElement

/** Overrides matchMedia so the card renders its mobile action menu. */
function setMobile() {
  window.matchMedia = ((query: string) => ({
    matches: /max-width|\(max-width/.test(query) ? true : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

const originalMatchMedia = window.matchMedia

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

describe('TableTimingsTab — states', () => {
  it('spins while the tables load', () => {
    const { container } = renderTab({ isPending: true })

    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it("shows the backend's own message on failure", () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Table areas unavailable.' } }
    renderTab({ isError: true, error })

    expect(screen.getByText('Table areas unavailable.')).toBeInTheDocument()
  })

  it('falls back to generic fetch copy when the body carries no message', () => {
    renderTab({ isError: true, error: new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL') })

    expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument()
  })

  it('offers the empty state with an add action', async () => {
    const { c } = renderTab({ tables: [] })

    expect(screen.getByText('No table timings yet')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /add new table timing/i }))

    expect(c.openAdd).toHaveBeenCalled()
  })

  it('shows the empty state without an add action while read-only', () => {
    renderTab({ tables: [], editable: false })

    expect(screen.getByText('No table timings yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add new table timing/i })).not.toBeInTheDocument()
  })
})

describe('TableTimingsTab — the grid', () => {
  it('renders a card per table', () => {
    renderTab()

    expect(screen.getByText('Window Table')).toBeInTheDocument()
    expect(screen.getByText("Chef's Counter")).toBeInTheDocument()
  })

  it('shows all seven weekdays, Monday first', () => {
    renderTab()
    const card = cardFor('Window Table')

    expect(
      ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
        (day) => within(card).getByText(day).textContent,
      ),
    ).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })

  it('renders wire times as 12-hour chips', () => {
    renderTab()
    const card = cardFor('Window Table')

    expect(within(card).getByText(/10:00 AM.*11:00 AM/)).toBeInTheDocument()
    expect(within(card).getByText(/4:00 PM.*5:00 PM/)).toBeInTheDocument()
  })

  it('labels a day with no ranges as Closed', () => {
    renderTab()
    const card = cardFor('Window Table')

    // Two of the seven days are open in the fixture, so five read Closed.
    expect(within(card).getAllByText('Closed')).toHaveLength(5)
  })

  it('badges a hidden table rather than filtering it out', () => {
    renderTab()
    const hidden = cardFor("Chef's Counter")

    expect(within(hidden).getByText('Hidden from diners')).toBeInTheDocument()
    // The corrected copy: hiding has no diner-facing effect.
    expect(
      within(hidden).getByText(/stays on interest tables it.s already assigned to/i),
    ).toBeInTheDocument()
  })

  it('does not badge a visible table', () => {
    renderTab()

    expect(
      within(cardFor('Window Table')).queryByText('Hidden from diners'),
    ).not.toBeInTheDocument()
  })
})

describe('TableTimingsTab — per-card actions', () => {
  it('opens the editor for the right table', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getByLabelText(/edit window table/i))

    expect(c.openEdit).toHaveBeenCalledWith(VISIBLE)
  })

  it('asks to delete the right table', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getByLabelText(/delete window table/i))

    expect(c.requestDelete).toHaveBeenCalledWith(VISIBLE)
  })

  it('offers Hide on a visible table', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getByLabelText(/hide window table from new interest tables/i))

    expect(c.requestVisibility).toHaveBeenCalledWith(VISIBLE)
  })

  it('offers Show on a hidden table', async () => {
    const { c } = renderTab()

    await userEvent.click(screen.getByLabelText(/offer chef's counter for new interest tables/i))

    expect(c.requestVisibility).toHaveBeenCalledWith(HIDDEN)
  })

  it('hides every action while read-only rather than disabling them', () => {
    renderTab({ editable: false })

    expect(screen.queryByLabelText(/edit window table/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/delete window table/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/hide window table/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add new table timing/i })).not.toBeInTheDocument()
    // The grid itself still renders — the read works in PENDING (BR-10).
    expect(screen.getByText('Window Table')).toBeInTheDocument()
  })

  it('collapses the actions into a menu on mobile', async () => {
    setMobile()
    const { c } = renderTab()

    await userEvent.click(screen.getAllByRole('button', { name: /more/i })[0])
    await userEvent.click(await screen.findByText('Hide'))

    expect(c.requestVisibility).toHaveBeenCalledWith(VISIBLE)
  })
})

describe('TableTimingsTab — the delete dialog', () => {
  it('names the table and confirms', async () => {
    const { c } = renderTab({ deleteTarget: VISIBLE })

    expect(screen.getByText(/Window Table.*table timing\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^delete$/i }))

    expect(c.confirmDelete).toHaveBeenCalled()
  })

  it('cancels', async () => {
    const { c } = renderTab({ deleteTarget: VISIBLE })

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(c.cancelDelete).toHaveBeenCalled()
  })
})

describe('TableTimingsTab — the hide/show dialog', () => {
  it('asks to hide a visible table, and explains what hiding really does', async () => {
    const { c } = renderTab({ visibilityTarget: VISIBLE })

    expect(screen.getByText(/Hide .*Window Table.* from diners\?/)).toBeInTheDocument()
    expect(
      screen.getByText(/stay on interest tables it.s already assigned to/i),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /^hide$/i }))
    expect(c.confirmVisibility).toHaveBeenCalled()
  })

  it('asks to show a hidden table', async () => {
    const { c } = renderTab({ visibilityTarget: HIDDEN })

    expect(screen.getByText(/Show .*Chef's Counter.* to diners again\?/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /^show$/i }))

    expect(c.confirmVisibility).toHaveBeenCalled()
  })

  it('cancels', async () => {
    const { c } = renderTab({ visibilityTarget: VISIBLE })

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(c.cancelVisibility).toHaveBeenCalled()
  })
})

describe('TableTimingsTab — the blocked-delete dialog (BR-09)', () => {
  it('offers hiding as the primary action, with the count', async () => {
    const { c } = renderTab({ blocked: { table: VISIBLE, upcomingTables: 2 } })

    expect(screen.getByText(/Can.t delete this table area/i)).toBeInTheDocument()
    expect(screen.getByText(/assigned to 2 upcoming interest tables/i)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /hide it instead/i }))
    expect(c.hideFromBlocked).toHaveBeenCalled()
  })

  it('uses the singular when just one table holds it', () => {
    renderTab({ blocked: { table: VISIBLE, upcomingTables: 1 } })

    expect(screen.getByText(/assigned to 1 upcoming interest table,/i)).toBeInTheDocument()
  })

  it('drops the number when the count is unusable rather than saying zero', () => {
    renderTab({ blocked: { table: VISIBLE, upcomingTables: 0 } })

    expect(screen.getByText(/assigned to an upcoming interest table/i)).toBeInTheDocument()
    expect(screen.queryByText(/0 upcoming/)).not.toBeInTheDocument()
  })

  it('dismisses', async () => {
    const { c } = renderTab({ blocked: { table: VISIBLE, upcomingTables: 2 } })

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(c.dismissBlocked).toHaveBeenCalled()
  })
})

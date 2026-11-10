import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { TableTimingFormModal } from '../components/TableTimingFormModal'
import { TABLE_LIMITS } from '../constants'
import { emptyAvailability, emptyWeekDraft } from '../format'
import type { useTableTimingsTab } from '../hooks/useTableTimingsTab'
import type { PartnerTable, TableFormDraft, WeekDraft } from '../types'
import type { TableFormErrors } from '../validation'

type Controller = ReturnType<typeof useTableTimingsTab>

const EDITING: PartnerTable = {
  tableId: 't1',
  name: 'Window Table',
  isHidden: false,
  availability: emptyAvailability(),
}

function week(overrides: Partial<WeekDraft> = {}): WeekDraft {
  return { ...emptyWeekDraft(), ...overrides }
}

function controller(overrides: Partial<Controller> = {}): Controller {
  return {
    tables: [],
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    editable: true,

    formOpen: true,
    editing: null,
    draft: { name: '', days: emptyWeekDraft() } as TableFormDraft,
    errors: {} as TableFormErrors,
    openAdd: vi.fn(),
    openEdit: vi.fn(),
    closeForm: vi.fn(),
    setName: vi.fn(),
    toggleDay: vi.fn(),
    setRange: vi.fn(),
    addRange: vi.fn(),
    removeRange: vi.fn(),
    copyDayToAll: vi.fn(),
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

function renderModal(overrides: Partial<Controller> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<TableTimingFormModal c={c} />) }
}

/** The bordered card for one weekday, found via its toggle's label. */
const dayCard = (name: string) =>
  screen.getByLabelText(name).closest('div.rounded-\\[12px\\]') as HTMLElement

describe('TableTimingFormModal — shell', () => {
  it('renders nothing while closed', () => {
    renderModal({ formOpen: false })

    expect(screen.queryByText('Add table timing')).not.toBeInTheDocument()
  })

  it('titles itself Add when creating', () => {
    renderModal()

    expect(screen.getByText('Add table timing')).toBeInTheDocument()
  })

  it('titles itself Edit when editing', () => {
    renderModal({ editing: EDITING, draft: { name: 'Window Table', days: emptyWeekDraft() } })

    expect(screen.getByText('Edit table timing')).toBeInTheDocument()
  })

  it('shows all seven weekdays, Monday first', () => {
    renderModal()

    const labels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    labels.forEach((label) => {
      expect(screen.getByLabelText(label)).toBeInTheDocument()
    })
  })

  it('cancels', async () => {
    const { c } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }))

    expect(c.closeForm).toHaveBeenCalled()
  })

  it('submits', async () => {
    const { c } = renderModal()

    await userEvent.click(screen.getByRole('button', { name: /^save$/i }))

    expect(c.submit).toHaveBeenCalled()
  })

  it('shows saving state and blocks a second submit', () => {
    renderModal({ saving: true })

    const save = screen.getByRole('button', { name: /saving/i })
    expect(save).toBeDisabled()
  })
})

describe('TableTimingFormModal — the name field', () => {
  it('reports edits and caps the length at the spec limit', async () => {
    const { c } = renderModal()
    const input = screen.getByLabelText('Table name')

    fireEvent.change(input, { target: { value: 'Rooftop Deck' } })

    expect(c.setName).toHaveBeenCalledWith('Rooftop Deck')
    expect(input).toHaveAttribute('maxlength', String(TABLE_LIMITS.nameMax))
  })

  it('pre-fills when editing', () => {
    renderModal({ editing: EDITING, draft: { name: 'Window Table', days: emptyWeekDraft() } })

    expect(screen.getByLabelText('Table name')).toHaveValue('Window Table')
  })

  it('shows a name error inline', () => {
    renderModal({ errors: { name: 'Table name is required.' } })

    expect(screen.getByText('Table name is required.')).toBeInTheDocument()
  })

  it('shows a duplicate-name conflict on the field, not as a toast', () => {
    renderModal({ errors: { name: 'A table area with this name already exists.' } })

    expect(screen.getByText('A table area with this name already exists.')).toBeInTheDocument()
  })

  it('surfaces a form-level message the server could not attribute', () => {
    renderModal({ errors: { general: 'Unrecognised field.' } })

    expect(screen.getByText('Unrecognised field.')).toBeInTheDocument()
  })
})

describe('TableTimingFormModal — weekday toggles', () => {
  it('collapses a closed day to just its switch', () => {
    renderModal()

    expect(within(dayCard('Wednesday')).queryByText('Add time range')).not.toBeInTheDocument()
  })

  it('opens a day', async () => {
    const { c } = renderModal()

    await userEvent.click(screen.getByLabelText('Wednesday'))

    expect(c.toggleDay).toHaveBeenCalledWith('3', true)
  })

  it('closes an open day', async () => {
    const { c } = renderModal({
      draft: { name: '', days: week({ '3': { open: true, ranges: [{ start: '', end: '' }] } }) },
    })

    await userEvent.click(screen.getByLabelText('Wednesday'))

    expect(c.toggleDay).toHaveBeenCalledWith('3', false)
  })

  it('reflects the open state on the switch', () => {
    renderModal({
      draft: { name: '', days: week({ '5': { open: true, ranges: [{ start: '', end: '' }] } }) },
    })

    expect(screen.getByLabelText('Friday')).toBeChecked()
    expect(screen.getByLabelText('Wednesday')).not.toBeChecked()
  })
})

describe('TableTimingFormModal — time ranges', () => {
  const oneOpenDay = (ranges: { start: string; end: string }[]) => ({
    name: 'Rooftop Deck',
    days: week({ '5': { open: true, ranges } }),
  })

  it('renders wire times in the picker as 12-hour', () => {
    renderModal({ draft: oneOpenDay([{ start: '18:00', end: '23:00' }]) })
    const card = dayCard('Friday')

    expect(within(card).getByDisplayValue('6:00 PM')).toBeInTheDocument()
    expect(within(card).getByDisplayValue('11:00 PM')).toBeInTheDocument()
  })

  it('leaves an unfilled range blank', () => {
    renderModal({ draft: oneOpenDay([{ start: '', end: '' }]) })
    const card = dayCard('Friday')

    expect(within(card).getByLabelText(/friday 10:00 AM/i)).toHaveValue('')
  })

  /**
   * The whole point of holding state in `HH:MM`: a picked time is stored in the
   * wire's format, so the request body never has to re-parse a display string and
   * a malformed time cannot reach the API.
   */
  it('stores a picked start time in 24-hour wire format', async () => {
    const { c } = renderModal({ draft: oneOpenDay([{ start: '', end: '' }]) })
    const input = within(dayCard('Friday')).getByLabelText(/friday 10:00 AM/i)

    fireEvent.change(input, { target: { value: '7:30 PM' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(c.setRange).toHaveBeenCalledWith('5', 0, { start: '19:30' })
  })

  it('stores a picked end time in 24-hour wire format', async () => {
    const { c } = renderModal({ draft: oneOpenDay([{ start: '19:30', end: '' }]) })
    const input = within(dayCard('Friday')).getByLabelText(/friday 11:00 PM/i)

    fireEvent.change(input, { target: { value: '11:45 PM' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    expect(c.setRange).toHaveBeenCalledWith('5', 0, { end: '23:45' })
  })

  it('converts a morning time without shifting it into the afternoon', () => {
    const { c } = renderModal({ draft: oneOpenDay([{ start: '', end: '' }]) })
    const input = within(dayCard('Friday')).getByLabelText(/friday 10:00 AM/i)

    fireEvent.change(input, { target: { value: '9:15 AM' } })
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' })

    // Zero-padded, which is what the backend requires — 9:15 would be a 422.
    expect(c.setRange).toHaveBeenCalledWith('5', 0, { start: '09:15' })
  })

  // No "clears to empty" case: the pickers set `allowClear={false}`, so the UI
  // cannot produce a null value. The `: ''` fallback in the handler is there for
  // the `Dayjs | null` signature, not for a reachable interaction.

  it('patches the second range, not the first, when a day holds several', () => {
    const { c } = renderModal({
      draft: oneOpenDay([
        { start: '12:00', end: '15:00' },
        { start: '', end: '' },
      ]),
    })
    const inputs = within(dayCard('Friday')).getAllByLabelText(/friday 10:00 AM/i)

    fireEvent.change(inputs[1], { target: { value: '6:00 PM' } })
    fireEvent.keyDown(inputs[1], { key: 'Enter', code: 'Enter' })

    expect(c.setRange).toHaveBeenCalledWith('5', 1, { start: '18:00' })
  })

  it('adds a range', async () => {
    const { c } = renderModal({ draft: oneOpenDay([{ start: '18:00', end: '23:00' }]) })

    await userEvent.click(within(dayCard('Friday')).getByText('Add time range'))

    expect(c.addRange).toHaveBeenCalledWith('5')
  })

  it('copies a day to the whole week', async () => {
    const { c } = renderModal({ draft: oneOpenDay([{ start: '18:00', end: '23:00' }]) })

    await userEvent.click(within(dayCard('Friday')).getByText('Copy to all days'))

    expect(c.copyDayToAll).toHaveBeenCalledWith('5')
  })

  /** A closed day has no hours to copy, and its whole action row is collapsed. */
  it('offers no copy action on a closed day', () => {
    renderModal()

    expect(within(dayCard('Wednesday')).queryByText('Copy to all days')).not.toBeInTheDocument()
  })

  /** The cap hides the add action; copying is unaffected by it. */
  it('keeps the copy action at the six-range cap', () => {
    const six = Array.from({ length: TABLE_LIMITS.rangesPerDayMax }, (_, index) => ({
      start: `0${String(index)}:00`,
      end: `0${String(index)}:30`,
    }))
    renderModal({ draft: oneOpenDay(six) })

    expect(within(dayCard('Friday')).getByText('Copy to all days')).toBeInTheDocument()
  })

  it('hides the add affordance at the six-range cap', () => {
    const six = Array.from({ length: TABLE_LIMITS.rangesPerDayMax }, (_, index) => ({
      start: `0${String(index)}:00`,
      end: `0${String(index)}:30`,
    }))
    renderModal({ draft: oneOpenDay(six) })

    expect(within(dayCard('Friday')).queryByText('Add time range')).not.toBeInTheDocument()
  })

  it('offers no remove button when a day holds a single range', () => {
    renderModal({ draft: oneOpenDay([{ start: '18:00', end: '23:00' }]) })

    expect(within(dayCard('Friday')).queryByLabelText(/remove time range/i)).not.toBeInTheDocument()
  })

  it('removes the right range when a day holds several', async () => {
    const { c } = renderModal({
      draft: oneOpenDay([
        { start: '12:00', end: '15:00' },
        { start: '18:00', end: '23:00' },
      ]),
    })

    const removes = within(dayCard('Friday')).getAllByLabelText(/remove time range/i)
    await userEvent.click(removes[1])

    expect(c.removeRange).toHaveBeenCalledWith('5', 1)
  })

  it('shows a per-range error against the offending row', () => {
    renderModal({
      draft: oneOpenDay([{ start: '18:00', end: '17:00' }]),
      errors: {
        days: { '5': { ranges: { 0: { end: 'End time must be after the start time.' } } } },
      },
    })

    expect(
      within(dayCard('Friday')).getByText('End time must be after the start time.'),
    ).toBeInTheDocument()
  })

  it('shows a day-level error such as an overlap', () => {
    renderModal({
      draft: oneOpenDay([
        { start: '15:00', end: '17:00' },
        { start: '16:00', end: '18:00' },
      ]),
      errors: { days: { '5': { general: "Time ranges on the same day can't overlap." } } },
    })

    expect(
      within(dayCard('Friday')).getByText("Time ranges on the same day can't overlap."),
    ).toBeInTheDocument()
  })

  it('shows the day-needs-a-range message on an open, empty day', () => {
    renderModal({
      draft: { name: 'Rooftop Deck', days: week({ '5': { open: true, ranges: [] } }) },
      errors: { days: { '5': { general: 'Add a time range, or switch this day off.' } } },
    })

    expect(
      within(dayCard('Friday')).getByText('Add a time range, or switch this day off.'),
    ).toBeInTheDocument()
  })

  it("keeps one day's errors off another day", () => {
    renderModal({
      draft: {
        name: 'Rooftop Deck',
        days: week({
          '5': { open: true, ranges: [{ start: '18:00', end: '17:00' }] },
          '6': { open: true, ranges: [{ start: '09:00', end: '12:00' }] },
        }),
      },
      errors: {
        days: { '5': { ranges: { 0: { end: 'End time must be after the start time.' } } } },
      },
    })

    expect(
      within(dayCard('Saturday')).queryByText('End time must be after the start time.'),
    ).not.toBeInTheDocument()
  })
})

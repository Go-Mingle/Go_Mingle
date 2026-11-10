import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { MenuOptionsTab } from '../components/MenuOptionsTab'
import type { useMenuOptionsTab } from '../hooks/useMenuOptionsTab'
import type { useMenuPdfSection } from '../hooks/useMenuPdfSection'
import type { MenuTab } from '../hooks/useMenuTab'
import type { MenuOption } from '../types'

type Options = ReturnType<typeof useMenuOptionsTab>
type Pdf = ReturnType<typeof useMenuPdfSection>

const VISIBLE: MenuOption = {
  comboId: 'c1',
  name: 'Signature Levantine',
  pricePkr: 180,
  isHidden: false,
  courses: [
    { course: 'Main Course', choose: 1, options: ['Chicken Biryani', 'Lamb Tikka'] },
    { course: 'Desserts', choose: 2, options: ['Kunafa'] },
  ],
}

const HIDDEN: MenuOption = {
  comboId: 'c2',
  name: 'Seafood Set',
  pricePkr: 195,
  isHidden: true,
  courses: [{ course: 'Main Course', choose: 1, options: ['Grilled Hammour'] }],
}

/** The PDF half is exercised in its own suite; here it is a settled empty state. */
function pdfStub(): Pdf {
  return {
    menuUrl: null,
    name: null,
    isPending: false,
    isError: false,
    error: null,
    editable: false,
    pickFile: vi.fn().mockReturnValue(false),
    uploading: false,
    progress: 0,
    uploadError: null,
    dismissUploadError: vi.fn(),
    confirmingDelete: false,
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    downloadPdf: vi.fn(),
    deleting: false,
  } as Pdf
}

function controller(overrides: Partial<Options> = {}): Options {
  return {
    options: [VISIBLE, HIDDEN],
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    editable: true,

    formOpen: false,
    editing: null,
    draft: { name: '', pricePkr: 0, courses: [{ course: '', choose: 1, options: [] }] },
    errors: {},
    openAdd: vi.fn(),
    openEdit: vi.fn(),
    closeForm: vi.fn(),
    setName: vi.fn(),
    setPrice: vi.fn(),
    addSection: vi.fn(),
    removeSection: vi.fn(),
    patchSection: vi.fn(),
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
  } as Options
}

function renderTab(overrides: Partial<Options> = {}) {
  const options = controller(overrides)
  const c: MenuTab = { pdf: pdfStub(), options }
  return { c: options, ...renderWithProviders(<MenuOptionsTab c={c} />) }
}

const cardFor = (name: string) =>
  screen.getByText(name).closest('div.rounded-\\[var\\(--radius-lg\\)\\]') as HTMLElement

describe('MenuOptionsTab — states', () => {
  it('spins while the combos load', () => {
    const { container } = renderTab({ isPending: true })
    // The PDF half has settled, so the only spinner is the combo grid's.
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message on failure', () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Menu options unavailable.' } }
    renderTab({ isError: true, error })

    expect(screen.getByText('Menu options unavailable.')).toBeInTheDocument()
  })

  it('invites a first combo when there are none', () => {
    renderTab({ options: [] })

    expect(screen.getByText('No menu options yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add menu option' })).toBeInTheDocument()
  })

  it('withholds the invitation’s button while read-only', () => {
    renderTab({ options: [], editable: false })

    expect(screen.getByText('No menu options yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add menu option' })).not.toBeInTheDocument()
  })

  it('renders the PDF section alongside the grid', () => {
    renderTab()
    expect(screen.getByText('Restaurant Menu')).toBeInTheDocument()
  })
})

describe('MenuOptionsTab — the grid', () => {
  it('renders a card per combo', () => {
    renderTab()

    expect(screen.getByText('Signature Levantine')).toBeInTheDocument()
    expect(screen.getByText('Seafood Set')).toBeInTheDocument()
  })

  it('shows the PKR price', () => {
    renderTab()
    expect(screen.getByText('PKR 180')).toBeInTheDocument()
  })

  it('shows each course section with its choice count and items', () => {
    renderTab()
    const card = cardFor('Signature Levantine')

    expect(within(card).getByText(/Main Course • Choice of one/)).toBeInTheDocument()
    // "Choice of two" rather than "Choice of 2" for the small counts in use.
    expect(within(card).getByText(/Desserts • Choice of two/)).toBeInTheDocument()
    expect(within(card).getByText('Chicken Biryani')).toBeInTheDocument()
    expect(within(card).getByText('Kunafa')).toBeInTheDocument()
  })

  /** Only the first three counts have words; larger ones fall back to the digit. */
  it('uses the numeral for a choice count beyond the spelled-out ones', () => {
    renderTab({
      options: [
        {
          ...VISIBLE,
          courses: [{ course: 'Mezze', choose: 4, options: ['A', 'B', 'C', 'D'] }],
        },
      ],
    })

    expect(screen.getByText(/Mezze • Choice of 4/)).toBeInTheDocument()
  })

  /**
   * Hidden combos stay in the grid and are badged — the point of AC-02.2. The
   * note is careful: hiding stops *new* interest tables, it does not withdraw the
   * combo from tables already serving it.
   */
  it('badges a hidden combo instead of dropping it', () => {
    renderTab()
    const card = cardFor('Seafood Set')

    expect(within(card).getByText('Hidden from diners')).toBeInTheDocument()
    expect(within(card).getByText(/not offered on new interest tables/i)).toBeInTheDocument()
  })

  it('does not badge a visible combo', () => {
    renderTab()
    expect(within(cardFor('Signature Levantine')).queryByText('Hidden from diners')).toBeNull()
  })
})

describe('MenuOptionsTab — the card actions', () => {
  it('opens the add modal', async () => {
    const { c } = renderTab()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Add menu option' }))

    expect(c.openAdd).toHaveBeenCalled()
  })

  it('opens the edit modal for the right combo', async () => {
    const { c } = renderTab()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Edit Signature Levantine' }))

    expect(c.openEdit).toHaveBeenCalledWith(expect.objectContaining({ comboId: 'c1' }))
  })

  it('asks to delete the right combo', async () => {
    const { c } = renderTab()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Delete Signature Levantine' }))

    expect(c.requestDelete).toHaveBeenCalledWith(expect.objectContaining({ comboId: 'c1' }))
  })

  /** The eye's label follows the combo's current state, not a fixed word. */
  it('labels the eye by what it will do', () => {
    renderTab()

    expect(
      screen.getByRole('button', { name: 'Hide Signature Levantine from diners' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Show Seafood Set to diners' })).toBeInTheDocument()
  })

  it('asks to toggle visibility', async () => {
    const { c } = renderTab()
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Hide Signature Levantine from diners' }))

    expect(c.requestVisibility).toHaveBeenCalledWith(expect.objectContaining({ comboId: 'c1' }))
  })
})

/** PENDING offers no control that would only 409 — absent, not disabled (BR-10). */
describe('MenuOptionsTab — read-only', () => {
  it('withholds Add and every per-card control', () => {
    renderTab({ editable: false })

    expect(screen.queryByRole('button', { name: 'Add menu option' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Delete / })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /from diners$/ })).not.toBeInTheDocument()
  })

  it('still renders the combos and their badges', () => {
    renderTab({ editable: false })

    expect(screen.getByText('Signature Levantine')).toBeInTheDocument()
    expect(within(cardFor('Seafood Set')).getByText('Hidden from diners')).toBeInTheDocument()
  })
})

describe('MenuOptionsTab — the confirm dialogs', () => {
  it('names the combo in the delete confirmation', () => {
    renderTab({ deleteTarget: VISIBLE })

    expect(screen.getByText('Delete menu option')).toBeInTheDocument()
    expect(screen.getByText(/Signature Levantine.*can't be undone/)).toBeInTheDocument()
  })

  /**
   * The subtitle is the point: hiding withdraws the combo from *new* interest
   * tables only, and the design's "hidden from diners" label is loose about that.
   */
  it('explains that hiding leaves existing interest tables alone', () => {
    renderTab({ visibilityTarget: VISIBLE })

    expect(screen.getByText(/Hide “Signature Levantine” from diners\?/)).toBeInTheDocument()
    expect(screen.getByText(/stay on interest tables it's already part of/i)).toBeInTheDocument()
  })

  it('offers the opposite copy for a hidden combo', () => {
    renderTab({ visibilityTarget: HIDDEN })

    expect(screen.getByText(/Show “Seafood Set” to diners again\?/)).toBeInTheDocument()
    expect(screen.getByText(/offered on new interest tables again/i)).toBeInTheDocument()
  })

  it('confirms the visibility change', async () => {
    const { c } = renderTab({ visibilityTarget: VISIBLE })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hide' }))

    expect(c.confirmVisibility).toHaveBeenCalled()
  })
})

describe('MenuOptionsTab — the blocked delete (BR-09)', () => {
  it('names the number of upcoming tables holding the combo', () => {
    renderTab({ blocked: { option: HIDDEN, upcomingTables: 2 } })

    expect(screen.getByText("Can't delete this menu option")).toBeInTheDocument()
    expect(screen.getByText(/2 upcoming interest tables/)).toBeInTheDocument()
  })

  it('uses the singular for one table', () => {
    renderTab({ blocked: { option: HIDDEN, upcomingTables: 1 } })
    expect(screen.getByText(/1 upcoming interest table,/)).toBeInTheDocument()
  })

  /** Better to say it without a number than to claim "0 upcoming tables". */
  it('says it without a number when the count is unknown', () => {
    renderTab({ blocked: { option: HIDDEN, upcomingTables: 0 } })

    expect(screen.getByText(/is used by an upcoming interest table/)).toBeInTheDocument()
    expect(screen.queryByText(/0 upcoming/)).not.toBeInTheDocument()
  })

  /** The escape hatch is an action, not just an explanation. */
  it('hides the combo straight from the dialog', async () => {
    const { c } = renderTab({ blocked: { option: HIDDEN, upcomingTables: 2 } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Hide it instead' }))

    expect(c.hideFromBlocked).toHaveBeenCalled()
  })

  it('can be dismissed without hiding', async () => {
    const { c } = renderTab({ blocked: { option: HIDDEN, upcomingTables: 2 } })
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))

    expect(c.dismissBlocked).toHaveBeenCalled()
    expect(c.hideFromBlocked).not.toHaveBeenCalled()
  })
})

describe('MenuOptionsTab — the form modal', () => {
  const open = (overrides: Partial<Options> = {}) => renderTab({ formOpen: true, ...overrides })

  /** Scoped: "Add menu option" is also the grid's button, outside the modal. */
  const modalTitle = () => document.querySelector('.ant-modal-title')?.textContent

  it('titles itself for a new combo', () => {
    open()
    expect(modalTitle()).toBe('Add menu option')
  })

  it('titles itself for an edit', () => {
    open({ editing: VISIBLE })
    expect(modalTitle()).toBe('Edit menu option')
  })

  it('renders the draft', () => {
    open({
      draft: {
        name: 'Weekend Brunch',
        pricePkr: 120,
        courses: [{ course: 'Starters', choose: 1, options: ['Soup'] }],
      },
    })

    expect(screen.getByLabelText('Menu name')).toHaveValue('Weekend Brunch')
    // Two decimals, because the field is `numeric(10,2)` PKR.
    expect(screen.getByLabelText('Price (PKR)')).toHaveValue('120.00')
    expect(screen.getByLabelText('Course name')).toHaveValue('Starters')
    expect(screen.getByText('Soup')).toBeInTheDocument()
  })

  it('reports the typed name', async () => {
    const { c } = open()
    await userEvent.setup().type(screen.getByLabelText('Menu name'), 'B')

    expect(c.setName).toHaveBeenCalledWith('B')
  })

  /**
   * An emptied price field yields null, which must reach validation as "missing"
   * rather than becoming a silent 0 — 0 is a legitimate complimentary combo, so
   * the two cannot be conflated.
   */
  it('reports the typed price, and an emptied one as missing rather than zero', async () => {
    const { c } = open({
      draft: { name: 'B', pricePkr: 120, courses: [{ course: 'A', choose: 1, options: ['x'] }] },
    })
    const user = userEvent.setup()
    const price = screen.getByLabelText('Price (PKR)')

    await user.clear(price)
    expect(c.setPrice).toHaveBeenCalledWith(Number.NaN)
    expect(c.setPrice).not.toHaveBeenCalledWith(0)

    await user.type(price, '55')
    expect(c.setPrice).toHaveBeenCalledWith(55)
  })

  it('reports a typed section name against its index', async () => {
    const { c } = open({
      draft: {
        name: '',
        pricePkr: 0,
        courses: [
          { course: '', choose: 1, options: [] },
          { course: '', choose: 1, options: [] },
        ],
      },
    })
    await userEvent.setup().type(screen.getAllByLabelText('Course name')[1], 'S')

    expect(c.patchSection).toHaveBeenCalledWith(1, { course: 'S' })
  })

  it('reports a changed choice count', async () => {
    const { c } = open()
    const choose = screen.getByLabelText('Choice of')

    const user = userEvent.setup()
    await user.clear(choose)
    await user.type(choose, '2')

    expect(c.patchSection).toHaveBeenCalledWith(0, { choose: 2 })
  })

  /** Chip with × to remove, per AC-03.3. The Modal portals to document.body. */
  it('reports a removed item chip', async () => {
    const { c } = open({
      draft: {
        name: '',
        pricePkr: 0,
        courses: [{ course: 'Starters', choose: 1, options: ['Soup', 'Salad'] }],
      },
    })

    const remove = document.querySelectorAll('.ant-select-selection-item-remove')
    expect(remove).toHaveLength(2)
    await userEvent.setup().click(remove[0])

    expect(c.patchSection).toHaveBeenCalledWith(0, { options: ['Salad'] })
  })

  it('adds and removes sections', async () => {
    const { c } = open({
      draft: {
        name: '',
        pricePkr: 0,
        courses: [
          { course: 'A', choose: 1, options: [] },
          { course: 'B', choose: 1, options: [] },
        ],
      },
    })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'Add Section' }))
    expect(c.addSection).toHaveBeenCalled()

    await user.click(screen.getAllByRole('button', { name: 'Remove section' })[1])
    expect(c.removeSection).toHaveBeenCalledWith(1)
  })

  /** With one section there is nothing to remove down to — the × is withheld. */
  it('offers no remove control on a lone section', () => {
    open()
    expect(screen.queryByRole('button', { name: 'Remove section' })).not.toBeInTheDocument()
  })

  it('submits', async () => {
    const { c } = open()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save' }))

    expect(c.submit).toHaveBeenCalled()
  })

  it('shows progress while saving', () => {
    open({ saving: true })
    expect(screen.getByText('Saving…')).toBeInTheDocument()
  })

  it('renders the inline field errors', () => {
    open({
      errors: {
        name: 'Menu name is required.',
        pricePkr: "Price can't be negative.",
        sections: {
          0: {
            course: 'Section name is required.',
            options: 'Add at least one item to this section.',
            choose: "You can't ask diners to choose more items than the section offers.",
          },
        },
      },
    })

    expect(screen.getByText('Menu name is required.')).toBeInTheDocument()
    expect(screen.getByText("Price can't be negative.")).toBeInTheDocument()
    expect(screen.getByText('Section name is required.')).toBeInTheDocument()
    expect(screen.getByText('Add at least one item to this section.')).toBeInTheDocument()
    expect(
      screen.getByText("You can't ask diners to choose more items than the section offers."),
    ).toBeInTheDocument()
  })

  it('renders a section-count error', () => {
    open({ errors: { courses: 'Add at least one section.' } })
    expect(screen.getByText('Add at least one section.')).toBeInTheDocument()
  })

  /** Nothing the server said is dropped, even when it cannot be placed. */
  it('renders an unattributed server message above the form', () => {
    open({ errors: { general: 'Something the form cannot place.' } })
    expect(screen.getByText('Something the form cannot place.')).toBeInTheDocument()
  })

  it('closes on cancel', async () => {
    const { c } = open()
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }))

    expect(c.closeForm).toHaveBeenCalled()
  })
})

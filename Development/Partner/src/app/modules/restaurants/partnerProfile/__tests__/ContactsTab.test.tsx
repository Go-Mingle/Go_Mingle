import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../../test-utils/renderWithProviders'
import { HttpError } from '../../../../../shared/api/httpClient'
import { ContactsTab } from '../components/ContactsTab'
import type { useProfileContacts } from '../hooks/useProfileContacts'
import type { PartnerContact } from '../types'

type Contacts = ReturnType<typeof useProfileContacts>

const CONTACTS: PartnerContact[] = [
  {
    id: 'ct-1',
    name: 'Osama Khalil',
    title: 'General Manager',
    email: 'osama@aurelia.pk',
    phone: '+923001234567',
  },
  { id: 'ct-2', name: 'Sara Aziz', title: null, email: null, phone: null },
]

/**
 * The component is driven by a plain stand-in rather than the real hook, so the
 * pending, error and per-column states can each be rendered directly.
 */
function controller(overrides: Partial<Contacts> = {}): Contacts {
  return {
    contacts: CONTACTS,
    isPending: false,
    isError: false,
    error: null,
    isFetching: false,
    sortBy: 'name',
    sortOrder: 'asc',
    applySort: vi.fn(),
    searchField: undefined,
    search: '',
    applySearch: vi.fn(),
    editable: true,
    formOpen: false,
    editing: null,
    form: { name: '', title: '', email: '', phone: '' },
    setForm: vi.fn(),
    errors: {},
    blocked: false,
    openAdd: vi.fn(),
    openEdit: vi.fn(),
    closeForm: vi.fn(),
    submitForm: vi.fn(),
    saving: false,
    deleteTarget: null,
    requestDelete: vi.fn(),
    cancelDelete: vi.fn(),
    confirmDelete: vi.fn(),
    deleting: false,
    canDelete: true,
    ...overrides,
  } as Contacts
}

function renderTab(overrides: Partial<Contacts> = {}) {
  const c = controller(overrides)
  return { c, ...renderWithProviders(<ContactsTab c={c} />) }
}

describe('ContactsTab states', () => {
  it('spins while loading', () => {
    const { container } = renderTab({ isPending: true })
    expect(container.querySelector('.ant-spin')).toBeInTheDocument()
  })

  it('shows the backend message on failure', () => {
    const error = new HttpError(500, 'Error', 'ERR_INTERNAL', 'ERR_INTERNAL')
    error.responseBody = { error: { message: 'Contacts unavailable.' } }
    renderTab({ isError: true, error })
    expect(screen.getByText('Contacts unavailable.')).toBeInTheDocument()
  })

  it('renders an em dash for each optional field left blank', () => {
    renderTab()
    const row = screen.getByText('Sara Aziz').closest('tr') as HTMLElement
    // Title, email and phone are all optional (BR-15).
    expect(within(row).getAllByText('—')).toHaveLength(3)
  })

  /** Stored compact E.164, grouped only for display. */
  it('groups a stored phone for display', () => {
    renderTab()
    expect(screen.getByText('+92 300 123 4567')).toBeInTheDocument()
  })

  it('shows the empty-state copy with no contacts', () => {
    renderTab({ contacts: [] })
    expect(screen.getByText(/no contacts yet/i)).toBeInTheDocument()
    // The rich empty state offers the add action inline.
    expect(screen.getByRole('button', { name: /add new contact/i })).toBeInTheDocument()
  })

  it('renders the email as a teal mailto link', () => {
    renderTab()
    const link = screen.getByRole('link', { name: 'osama@aurelia.pk' })
    expect(link).toHaveAttribute('href', 'mailto:osama@aurelia.pk')
  })
})

/** The four documented columns, with the field each one sorts and searches on. */
const COLUMNS = [
  ['Name', 'name'],
  ['Title', 'title'],
  ['Email', 'email'],
  ['Phone', 'phone'],
] as const

/**
 * Both affordances are addressed by accessible name, never by
 * `querySelector('svg')` — an unnamed icon is exactly the defect being fixed
 * (AC-05.1 / MET-1252), and an svg-only assertion would pass straight through it.
 */
const sortControl = (label: string) => screen.getByRole('img', { name: `Sort by ${label}` })
const searchControl = (label: string) => screen.getByRole('img', { name: `Search ${label}` })

describe('ContactsTab sorting', () => {
  it.each(COLUMNS)('offers a named sort control on %s', (label) => {
    renderTab()
    expect(sortControl(label)).toBeInTheDocument()
  })

  it.each(COLUMNS)('asks the caller to sort by %s', (label, field) => {
    const { c } = renderTab()
    fireEvent.click(sortControl(label).closest('th') as HTMLElement)
    expect(c.applySort).toHaveBeenCalledWith(field)
  })

  it('marks the active column with an accent sort arrow', () => {
    renderTab({ sortBy: 'email', sortOrder: 'asc' })
    expect(sortControl('Email').querySelector('svg')?.getAttribute('class')).toContain(
      'text-[var(--color-accent)]',
    )
  })

  it('leaves inactive columns with a neutral sort arrow', () => {
    renderTab({ sortBy: 'name', sortOrder: 'asc' })
    expect(sortControl('Phone').querySelector('svg')?.getAttribute('class')).toContain(
      'text-[var(--color-text-subtle)]',
    )
  })

  /** The sort state is machine-readable, not just a coloured arrow. */
  it.each([
    ['asc', 'ascending'],
    ['desc', 'descending'],
  ] as const)('reports aria-sort=%s as %s on the active column', (order, expected) => {
    renderTab({ sortBy: 'title', sortOrder: order })
    expect(sortControl('Title').closest('th')).toHaveAttribute('aria-sort', expected)
    expect(sortControl('Phone').closest('th')).toHaveAttribute('aria-sort', 'none')
  })
})

describe('ContactsTab search', () => {
  const openSearch = (label: string) => {
    fireEvent.click(searchControl(label).closest('.ant-table-filter-trigger') as HTMLElement)
  }

  it.each(COLUMNS)('offers a named search control on %s', (label) => {
    renderTab()
    expect(searchControl(label)).toBeInTheDocument()
  })

  it.each(COLUMNS)(
    'passes a %s term with its field, since a term alone is a no-op server-side',
    async (label, field) => {
      const { c } = renderTab()
      openSearch(label)
      const input = await screen.findByRole('textbox')
      await userEvent.setup().type(input, 'osama{Enter}')
      expect(c.applySearch).toHaveBeenCalledWith(field, 'osama')
    },
  )

  it('clears the field through Reset', async () => {
    const { c } = renderTab({ searchField: 'email', search: 'osama' })
    openSearch('Email')
    fireEvent.click(await screen.findByRole('button', { name: /reset/i }))
    expect(c.applySearch).toHaveBeenCalledWith(undefined, '')
  })

  /** Blank means "no search" — a field without a term would be dropped anyway. */
  it('drops the field when the term is only whitespace', async () => {
    const { c } = renderTab()
    openSearch('Phone')
    const input = await screen.findByRole('textbox')
    await userEvent.setup().type(input, '   {Enter}')
    expect(c.applySearch).toHaveBeenCalledWith(undefined, '   ')
  })

  /**
   * The endpoint holds one field/term pair, so a dropdown shows the live term
   * only on the column that owns it — otherwise Name would echo Title's search.
   */
  it('seeds only the searched column with the active term', async () => {
    renderTab({ searchField: 'title', search: 'manager' })

    openSearch('Title')
    expect(await screen.findByRole('textbox')).toHaveValue('manager')

    openSearch('Name')
    const inputs = screen.getAllByRole('textbox')
    expect(inputs[inputs.length - 1]).toHaveValue('')
  })

  it('marks only the searched column as filtered', () => {
    renderTab({ searchField: 'email', search: 'aurelia' })
    expect(searchControl('Email').closest('.ant-table-filter-trigger')).toHaveClass('active')
    expect(searchControl('Name').closest('.ant-table-filter-trigger')).not.toHaveClass('active')
  })

  /** A search that matches nothing keeps the table, so the controls stay reachable. */
  it('keeps the table rather than the empty state while searching', () => {
    renderTab({ contacts: [], searchField: 'name', search: 'zzz' })
    // The rich first-time prompt is for a genuinely empty tab, not a miss.
    expect(screen.queryByText(/add the people diners/i)).not.toBeInTheDocument()
    COLUMNS.forEach(([label]) => expect(searchControl(label)).toBeInTheDocument())
  })
})

describe('ContactsTab row actions', () => {
  it('opens the edit modal for a row', async () => {
    const { c } = renderTab()
    const row = screen.getByText('Osama Khalil').closest('tr') as HTMLElement
    await userEvent.setup().click(within(row).getByRole('button', { name: /edit/i }))
    expect(c.openEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'ct-1' }))
  })

  it('requests a delete confirmation rather than deleting outright', async () => {
    const { c } = renderTab()
    const row = screen.getByText('Osama Khalil').closest('tr') as HTMLElement
    await userEvent.setup().click(within(row).getByRole('button', { name: /delete/i }))
    expect(c.requestDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'ct-1' }))
    expect(c.confirmDelete).not.toHaveBeenCalled()
  })

  it('names the contact in the confirmation', () => {
    renderTab({ deleteTarget: CONTACTS[0] })
    expect(screen.getByText(/remove osama khalil/i)).toBeInTheDocument()
  })

  /** Pending is read-only end to end — every write would 409. */
  it('offers no add or row actions while read-only', () => {
    renderTab({ editable: false })
    expect(screen.queryByRole('button', { name: /add new contact/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
  })

  it('opens the add modal', async () => {
    const { c } = renderTab()
    await userEvent.setup().click(screen.getByRole('button', { name: /add new contact/i }))
    expect(c.openAdd).toHaveBeenCalled()
  })
})

describe('ContactsTab form modal', () => {
  /** Scoped to the title — the trigger button carries the same label. */
  const modalTitle = () => document.querySelector('.ant-modal-title')?.textContent

  it('titles itself for adding versus editing', () => {
    const { unmount } = renderTab({ formOpen: true, editing: null })
    expect(modalTitle()).toBe('Add new contact')
    unmount()

    renderTab({ formOpen: true, editing: CONTACTS[0] })
    expect(modalTitle()).toBe('Edit contact')
  })

  it('disables Save while the form holds errors', () => {
    renderTab({ formOpen: true, blocked: true })
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled()
  })

  it('renders the inline errors against their fields', () => {
    renderTab({
      formOpen: true,
      errors: { name: 'Contact name is required.', phone: 'Enter a number with its country code.' },
    })

    expect(screen.getByText('Contact name is required.')).toBeInTheDocument()
    expect(screen.getByText('Enter a number with its country code.')).toBeInTheDocument()
  })

  it('submits a valid form', async () => {
    const { c } = renderTab({ formOpen: true })
    await userEvent.setup().click(screen.getByRole('button', { name: /^save$/i }))
    expect(c.submitForm).toHaveBeenCalled()
  })

  it('caps the name at the contract limit', () => {
    renderTab({ formOpen: true })
    const modal = document.querySelector('.ant-modal') as HTMLElement
    expect(modal.querySelectorAll('input')[0]).toHaveAttribute('maxlength', '100')
  })

  it.each([
    [0, 'name', 'Laiba Hassan'],
    [1, 'title', 'Floor Manager'],
    [2, 'email', 'laiba@aurelia.pk'],
    [3, 'phone', '+923009876543'],
  ])('reports an edit to field %i (%s) without dropping the others', (index, field, value) => {
    const { c } = renderTab({ formOpen: true })
    const inputs = (document.querySelector('.ant-modal') as HTMLElement).querySelectorAll('input')
    fireEvent.change(inputs[index as number], { target: { value } })
    // The whole form is echoed back, so an edit to one field cannot clear another.
    expect(c.setForm).toHaveBeenCalledWith({
      name: '',
      title: '',
      email: '',
      phone: '',
      [field]: value,
    })
  })

  it('closes without saving', async () => {
    const { c } = renderTab({ formOpen: true })
    await userEvent.setup().click(screen.getByRole('button', { name: /cancel/i }))
    expect(c.closeForm).toHaveBeenCalled()
    expect(c.submitForm).not.toHaveBeenCalled()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { UsersTable } from '../components/UsersTable'
import { toListParams } from '../adapters'
import type { UserRow } from '../types'

function row(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: 'pu-2',
    name: 'Yasmeen Iqbal',
    designation: 'General Manager',
    status: 'active',
    lastActive: '2026-05-04',
    initials: 'YI',
    isPrimary: false,
    canSuspend: true,
    canDelete: true,
    ...overrides,
  }
}

const data: UserRow[] = [
  row(),
  row({ id: 'pu-4', name: 'Laiba Naseer', status: 'suspended', designation: undefined }),
]

function renderTable(props: Partial<React.ComponentProps<typeof UsersTable>> = {}) {
  return renderWithProviders(
    <UsersTable
      data={data}
      onEdit={() => {}}
      onResetPassword={() => {}}
      onDelete={() => {}}
      onListParamsChange={() => {}}
      {...props}
    />,
  )
}

/** The action cell is icon-only, so reach it through its aria-labels. */
function actionButtons(container: HTMLElement, rowIndex: number) {
  const rows = container.querySelectorAll('tbody tr.ant-table-row')
  return Array.from(rows[rowIndex].querySelectorAll('[role="button"]'))
}

describe('UsersTable rendering', () => {
  it('renders a row per user', () => {
    renderTable()
    expect(screen.getByText('Yasmeen Iqbal')).toBeInTheDocument()
    expect(screen.getByText('Laiba Naseer')).toBeInTheDocument()
  })

  it('renders an em dash for a user with no designation', () => {
    renderTable()
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('formats last active as DD-MM-YYYY', () => {
    renderTable({ data: [row()] })
    expect(screen.getByText('04-05-2026')).toBeInTheDocument()
  })

  it('renders an em dash when the user has never logged in (BR-13)', () => {
    renderTable({ data: [row({ lastActive: undefined })] })
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('shows both status labels', () => {
    renderTable()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getByText('Suspended')).toBeInTheDocument()
  })

  it('fires each row action', () => {
    const onEdit = vi.fn()
    const onResetPassword = vi.fn()
    const onDelete = vi.fn()
    const { container } = renderTable({ onEdit, onResetPassword, onDelete })

    const buttons = actionButtons(container, 0)
    expect(buttons).toHaveLength(3)
    buttons.forEach((button) => fireEvent.click(button))

    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'pu-2' }))
    expect(onResetPassword).toHaveBeenCalled()
    expect(onDelete).toHaveBeenCalled()
  })

  it('withholds the delete icon on a row the server marks undeletable (BR-03)', () => {
    const { container } = renderTable({
      data: [row({ isPrimary: true, canSuspend: false, canDelete: false })],
    })
    const buttons = actionButtons(container, 0)
    // Edit and set-password remain; only Delete is gone.
    expect(buttons).toHaveLength(2)
  })

  it('reports a sort change to the caller rather than reordering locally', async () => {
    const onListParamsChange = vi.fn()
    renderTable({ onListParamsChange })

    await userEvent.setup().click(screen.getAllByRole('columnheader')[0])

    expect(onListParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ sortBy: 'name', sortOrder: 'asc' }),
    )
  })
})

/**
 * MET-1247 (TC-PARTNER-USERS-012/013/014). The search, status and date-range
 * controls were all built and all round-tripped their query param, but every
 * trigger was a bare <svg> with no role and no accessible name — so they were
 * unreachable by assistive tech and by any selector-driven QA sweep, and the
 * list was reported as having no filtering at all. These assert each control is
 * *nameable*, which is the part that regressed.
 */
describe('UsersTable filter affordances are discoverable (MET-1247)', () => {
  /** The trigger antd wraps around a `filterIcon`. */
  function filterTrigger(name: string) {
    const icon = screen.getByRole('img', { name })
    const trigger = icon.closest('.ant-table-filter-trigger')
    expect(trigger).not.toBeNull()
    return trigger as HTMLElement
  }

  it('names the sort affordance on all four sortable columns', () => {
    renderTable()
    ;['NAME', 'DESIGNATION', 'LAST ACTIVE', 'STATUS'].forEach((column) => {
      expect(screen.getByRole('img', { name: `Sort by ${column}` })).toBeInTheDocument()
    })
  })

  it('offers a named search control on Name and on Designation (TC-012)', () => {
    renderTable()
    expect(screen.getByRole('img', { name: 'Search by NAME' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Search by DESIGNATION' })).toBeInTheDocument()
  })

  it('offers a named Status filter (TC-013)', () => {
    renderTable()
    expect(screen.getByRole('img', { name: 'Filter by STATUS' })).toBeInTheDocument()
  })

  it('offers a named Last Active date filter (TC-014)', () => {
    renderTable()
    expect(screen.getByRole('img', { name: 'Filter by LAST ACTIVE' })).toBeInTheDocument()
  })

  it('drives a name search through to search + searchField', async () => {
    const onListParamsChange = vi.fn()
    renderTable({ onListParamsChange })
    const user = userEvent.setup()

    await user.click(filterTrigger('Search by NAME'))
    await user.type(screen.getByRole('textbox', { name: 'Search by NAME' }), 'yas')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(onListParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'yas', searchField: 'name' }),
    )
  })

  it('drives a designation search through to its own field', async () => {
    const onListParamsChange = vi.fn()
    renderTable({ onListParamsChange })
    const user = userEvent.setup()

    await user.click(filterTrigger('Search by DESIGNATION'))
    await user.type(screen.getByRole('textbox', { name: 'Search by DESIGNATION' }), 'manager')
    await user.click(screen.getByRole('button', { name: 'Search' }))

    expect(onListParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'manager', searchField: 'designation' }),
    )
  })

  it('drives the Status filter through to the uppercase API value', async () => {
    const onListParamsChange = vi.fn()
    renderTable({ onListParamsChange })
    const user = userEvent.setup()

    await user.click(filterTrigger('Filter by STATUS'))

    const dropdown = document.querySelector('.ant-table-filter-dropdown') as HTMLElement
    await user.click(within(dropdown).getByText('Suspended'))
    await user.click(within(dropdown).getByRole('button', { name: /ok/i }))

    expect(onListParamsChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['SUSPENDED'] }),
    )
  })

  it('opens a labelled date range picker on Last Active', async () => {
    renderTable()
    await userEvent.setup().click(filterTrigger('Filter by LAST ACTIVE'))

    expect(screen.getByText('Filter by LAST ACTIVE')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('From')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('To')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument()
  })
})

/**
 * MET-1307 (TC-PARTNER-USERS-012c). The grid passed no `locale`, so an empty
 * body fell through to AntD's built-in placeholder no matter why it was empty.
 */
describe('UsersTable empty body (MET-1307)', () => {
  it('renders the caller-supplied empty body', () => {
    renderTable({ data: [], emptyText: <span>Nothing matched</span> })
    expect(screen.getByText('Nothing matched')).toBeInTheDocument()
    expect(screen.queryByText('No data')).not.toBeInTheDocument()
  })

  it('falls back to AntD default when the caller supplies nothing', () => {
    const { container } = renderTable({ data: [] })
    expect(container.querySelector('.ant-empty-description')).toHaveTextContent('No data')
  })

  it('leaves the column headers — and their filters — in place while empty', () => {
    renderTable({ data: [], emptyText: <span>Nothing matched</span> })
    // The advice is "clear the filter", so the filter must still be on screen.
    expect(screen.getByRole('img', { name: 'Search by NAME' })).toBeInTheDocument()
  })
})

describe('toListParams', () => {
  const noFilters: Record<string, FilterValue | null> = {}
  const noSort = {} as SorterResult<UserRow>

  it('returns nothing when the table is untouched', () => {
    expect(toListParams(noFilters, noSort)).toEqual({})
  })

  it('maps ascend and descend onto the API vocabulary', () => {
    expect(
      toListParams(noFilters, { columnKey: 'name', order: 'ascend' } as SorterResult<UserRow>),
    ).toMatchObject({ sortBy: 'name', sortOrder: 'asc' })
    expect(
      toListParams(noFilters, { columnKey: 'status', order: 'descend' } as SorterResult<UserRow>),
    ).toMatchObject({ sortBy: 'status', sortOrder: 'desc' })
  })

  it('ignores a cleared sort', () => {
    expect(
      toListParams(noFilters, { columnKey: 'name', order: null } as SorterResult<UserRow>),
    ).toEqual({})
  })

  it('ignores a column that is not sortable server-side', () => {
    expect(
      toListParams(noFilters, { columnKey: 'actions', order: 'ascend' } as SorterResult<UserRow>),
    ).toEqual({})
  })

  it('takes the first sorter when AntD hands back an array', () => {
    expect(
      toListParams(noFilters, [
        { columnKey: 'designation', order: 'ascend' },
      ] as SorterResult<UserRow>[]),
    ).toMatchObject({ sortBy: 'designation', sortOrder: 'asc' })
  })

  it('maps the name search box to search + searchField', () => {
    expect(toListParams({ name: ['yas'] }, noSort)).toEqual({
      search: 'yas',
      searchField: 'name',
    })
  })

  it('maps the designation search box to its own field', () => {
    expect(toListParams({ designation: ['manager'] }, noSort)).toEqual({
      search: 'manager',
      searchField: 'designation',
    })
  })

  it('prefers the name box when both somehow carry a value', () => {
    expect(toListParams({ name: ['a'], designation: ['b'] }, noSort)).toMatchObject({
      search: 'a',
      searchField: 'name',
    })
  })

  it('ignores a blank search term', () => {
    expect(toListParams({ name: ['   '] }, noSort)).toEqual({})
  })

  it('uppercases the status filter for the API', () => {
    expect(toListParams({ status: ['active', 'suspended'] }, noSort)).toEqual({
      status: ['ACTIVE', 'SUSPENDED'],
    })
  })

  it('omits the status filter when nothing is selected', () => {
    expect(toListParams({ status: [] }, noSort)).toEqual({})
  })

  it('maps a complete date range to YYYY-MM-DD bounds', () => {
    const range = [dayjs('2026-01-01'), dayjs('2026-02-01')]
    expect(toListParams({ lastActive: [range] as unknown as FilterValue }, noSort)).toEqual({
      lastActiveFrom: '2026-01-01',
      lastActiveTo: '2026-02-01',
    })
  })

  it('ignores a half-open date range rather than sending a 400', () => {
    const range = [dayjs('2026-01-01'), null]
    expect(toListParams({ lastActive: [range] as unknown as FilterValue }, noSort)).toEqual({})
  })

  it('ignores a cleared date filter', () => {
    expect(toListParams({ lastActive: null }, noSort)).toEqual({})
  })
})

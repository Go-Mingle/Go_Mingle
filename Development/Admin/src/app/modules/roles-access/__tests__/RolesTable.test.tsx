import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { RolesTable } from '../components/RolesTable'

const rows = [
  { id: '1', name: 'Admin', fullAccess: true, permissions: [], usersAssigned: 5 },
  {
    id: '2',
    name: 'Manager',
    fullAccess: false,
    permissions: ['RESTAURANT_APPROVALS', 'MANAGE_MINGLERS'],
    usersAssigned: 0,
  },
]

const defaultSortProps = { sortBy: 'name' as const, sortDir: 'desc' as const }

describe('RolesTable', () => {
  it('renders fullAccess and module chips', async () => {
    const onEdit = vi.fn()
    const onDel = vi.fn()
    const onChange = vi.fn()
    const { container } = renderWithProviders(
      <RolesTable
        pagedData={rows}
        {...defaultSortProps}
        onEdit={onEdit}
        onDeleteTarget={onDel}
        onTableChange={onChange}
      />,
    )
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Manager')).toBeInTheDocument()
    // Click edit/delete on first row
    // Antd renders a hidden measurement row first; use ant-table-row selector
    const dataRows = container.querySelectorAll('tbody tr.ant-table-row')
    const lastCell = dataRows[0].querySelectorAll('td')
    const actionsCell = lastCell[lastCell.length - 1]
    // Each action has a Tooltip wrapper plus inner div with svg.
    // Get the direct child div containing svg (not parent wrappers).
    const allWithSvg = Array.from(actionsCell.querySelectorAll('div')).filter((d) =>
      d.querySelector('svg'),
    )
    // Click all matching divs; redundant clicks are no-ops (already triggered)
    for (const div of allWithSvg) fireEvent.click(div)
    expect(onEdit).toHaveBeenCalled()
    expect(onDel).toHaveBeenCalled()
  })

  it('renders a loading overlay on the table without unmounting it', () => {
    const { container } = renderWithProviders(
      <RolesTable
        pagedData={rows}
        {...defaultSortProps}
        loading
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    expect(container.querySelector('.ant-spin-spinning')).toBeInTheDocument()
    // The table itself (and its data) stays mounted under the loading overlay.
    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('triggers sorts on column headers', async () => {
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        {...defaultSortProps}
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    for (const h of headers) {
      await user.click(h)
      await user.click(h)
      await user.click(h)
    }
  })

  it('reports sortBy=name and the toggled direction when the Role Name header is clicked', async () => {
    const onTableChange = vi.fn()
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        // Name starts inactive (sortOrder=null) so the click below is a clean
        // null → ascend transition rather than cycling off an active sort.
        sortBy="usersAssigned"
        sortDir="asc"
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={onTableChange}
      />,
    )
    const user = userEvent.setup()
    // Column order is Role name, Modules, Users Assigned, Created — only the
    // first two columns render a `.ant-table-column-sorters` wrapper.
    const sorters = document.querySelectorAll('.ant-table-column-sorters')
    await user.click(sorters[0] as HTMLElement)
    expect(onTableChange).toHaveBeenCalled()
    const [, , sorter] = onTableChange.mock.calls[0]
    expect(sorter.columnKey).toBe('name')
    expect(sorter.order).toBe('ascend')
  })

  it('reports sortBy=usersAssigned when the Users Assigned header is clicked', async () => {
    const onTableChange = vi.fn()
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        sortBy="name"
        sortDir="desc"
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={onTableChange}
      />,
    )
    const user = userEvent.setup()
    const sorters = document.querySelectorAll('.ant-table-column-sorters')
    await user.click(sorters[1] as HTMLElement)
    expect(onTableChange).toHaveBeenCalled()
    const [, , sorter] = onTableChange.mock.calls[0]
    expect(sorter.columnKey).toBe('usersAssigned')
  })

  it('does not render sort controls for the Modules or Created columns', () => {
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        {...defaultSortProps}
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    // Only Role Name and Users Assigned render a sorters wrapper; its text
    // content should never be "Modules" or "Created".
    const sorterLabels = Array.from(document.querySelectorAll('.ant-table-column-sorters')).map(
      (el) => el.textContent,
    )
    expect(sorterLabels.length).toBeGreaterThan(0)
    expect(sorterLabels.some((label) => label?.includes('Modules'))).toBe(false)
    expect(sorterLabels.some((label) => label?.includes('Created'))).toBe(false)
  })

  it('does not render a filter trigger for the Modules or Users Assigned columns', () => {
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        {...defaultSortProps}
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    // Only the Role Name column has a search filter — per the API design,
    // Modules has no filter at all and Users Assigned has no search filter.
    // (antd renders an extra off-screen `.ant-table-filter-trigger` node with
    // no `<th>` ancestor for internal measurement — scope to real header cells.)
    const filterTriggers = Array.from(
      document.querySelectorAll('.ant-table-filter-trigger'),
    ).filter((t) => t.closest('th'))
    expect(filterTriggers.length).toBe(1)
  })

  it('reports filters.name via onTableChange when the Search button is pressed', async () => {
    const onTableChange = vi.fn()
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        sortBy="name"
        sortDir="desc"
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={onTableChange}
      />,
    )
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await user.type(input, 'manager')
    const searchBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /search/i.test(b.textContent ?? ''))
    await user.click(searchBtn as HTMLElement)
    expect(onTableChange).toHaveBeenCalled()
    const [, filters] = onTableChange.mock.calls[onTableChange.mock.calls.length - 1]
    expect(filters.name).toEqual(['manager'])
  })

  it('keeps the typed search text visible in the dropdown after Search is pressed', async () => {
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        sortBy="name"
        sortDir="desc"
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await user.type(input, 'manager')
    const searchBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /search/i.test(b.textContent ?? ''))
    await user.click(searchBtn as HTMLElement)
    // Reopen the dropdown — the previously typed value must not be lost.
    await user.click(filterTriggers[0] as HTMLElement)
    const reopenedInput = document.querySelector(
      '.ant-table-filter-dropdown input',
    ) as HTMLInputElement
    expect(reopenedInput.value).toBe('manager')
  })

  it('reports an empty filters.name via onTableChange when the Reset button is pressed', async () => {
    const onTableChange = vi.fn()
    renderWithProviders(
      <RolesTable
        pagedData={rows}
        sortBy="name"
        sortDir="desc"
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={onTableChange}
      />,
    )
    const user = userEvent.setup()
    const filterTriggers = document.querySelectorAll('.ant-table-filter-trigger')
    await user.click(filterTriggers[0] as HTMLElement)
    const input = document.querySelector('.ant-table-filter-dropdown input') as HTMLInputElement
    await user.type(input, 'manager')
    const searchBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /search/i.test(b.textContent ?? ''))
    await user.click(searchBtn as HTMLElement)

    await user.click(filterTriggers[0] as HTMLElement)
    const resetBtn = Array.from(
      document.querySelectorAll('.ant-table-filter-dropdown button'),
    ).find((b) => /reset/i.test(b.textContent ?? ''))
    await user.click(resetBtn as HTMLElement)
    const [, filters] = onTableChange.mock.calls[onTableChange.mock.calls.length - 1]
    expect(filters.name ?? []).toHaveLength(0)
  })

  it('handles unknown module key falling back to key', () => {
    renderWithProviders(
      <RolesTable
        pagedData={[
          { id: '3', name: 'X', fullAccess: false, permissions: ['unknownKey'], usersAssigned: 1 },
        ]}
        {...defaultSortProps}
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    expect(screen.getByText('unknownKey')).toBeInTheDocument()
  })

  it('renders a module label fallback for an unmapped key and a permissionless row', () => {
    // 'MYSTERY_KEY' is not in ALL_MODULES, so its render falls back to the key
    // itself. The second row has no permissions array → the `permissions ?? []`
    // render fallback is exercised too.
    const data = [
      {
        id: 'u',
        name: 'Mystery',
        fullAccess: false,
        permissions: ['MYSTERY_KEY'],
        usersAssigned: 1,
      },
      { id: 'n', name: 'NoPerms', fullAccess: false, usersAssigned: 0 },
    ] as unknown as Parameters<typeof RolesTable>[0]['pagedData']
    renderWithProviders(
      <RolesTable
        pagedData={data}
        {...defaultSortProps}
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    expect(screen.getByText('Mystery')).toBeInTheDocument()
    expect(screen.getByText('MYSTERY_KEY')).toBeInTheDocument()
    expect(screen.getByText('NoPerms')).toBeInTheDocument()
  })

  it('handles rows with missing permissions/usersAssigned/createdAt across all sorters', async () => {
    // Sparse rows force the nullish fallbacks in the column sorters and renderers
    // (permissions ?? [], usersAssigned ?? 0, createdAt truthy/falsy branches).
    const sparse = [
      { id: 'a', name: 'Alpha', fullAccess: false, createdAt: '2024-01-01T00:00:00.000Z' },
      { id: 'b', name: 'Beta', fullAccess: false },
    ] as unknown as Parameters<typeof RolesTable>[0]['pagedData']
    renderWithProviders(
      <RolesTable
        pagedData={sparse}
        {...defaultSortProps}
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    for (const h of headers) {
      await user.click(h)
      await user.click(h)
    }
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('row without permissions array uses default empty', () => {
    renderWithProviders(
      <RolesTable
        pagedData={[
          { id: '4', name: 'Empty', fullAccess: false, permissions: [], usersAssigned: 0 },
        ]}
        {...defaultSortProps}
        onEdit={() => {}}
        onDeleteTarget={() => {}}
        onTableChange={() => {}}
      />,
    )
    expect(screen.getByText('Empty')).toBeInTheDocument()
  })
})

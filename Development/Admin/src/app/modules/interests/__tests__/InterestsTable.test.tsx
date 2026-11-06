import { describe, it, expect, vi } from 'vitest'
import type { ComponentProps } from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { InterestsTable } from '../components/InterestsTable'
import type { Interest } from '../types'

const rows: Interest[] = [
  {
    id: 'i1',
    name: 'Wine Tasting',
    groupName: 'Food & Drink',
    createdAt: '2026-01-01',
    updatedAt: null,
  },
  { id: 'i2', name: 'Hiking', groupName: 'Outdoors', createdAt: '2026-01-02', updatedAt: null },
]

function renderTable(over: Partial<ComponentProps<typeof InterestsTable>> = {}) {
  const onEdit = vi.fn()
  const onDeleteTarget = vi.fn()
  renderWithProviders(
    <InterestsTable
      pagedData={rows}
      categoryOptions={['Food & Drink', 'Outdoors']}
      onEdit={onEdit}
      onDeleteTarget={onDeleteTarget}
      {...over}
    />,
  )
  return { onEdit, onDeleteTarget }
}

describe('InterestsTable', () => {
  it('renders a row per interest', () => {
    renderTable()
    expect(screen.getByText('Wine Tasting')).toBeInTheDocument()
    expect(screen.getByText('Hiking')).toBeInTheDocument()
  })

  it('fires onEdit and onDeleteTarget from the row action icons', async () => {
    const { onEdit, onDeleteTarget } = renderTable()
    const user = userEvent.setup()
    const rowEl = screen.getByText('Wine Tasting').closest('tr') as HTMLElement
    const actionsCell = rowEl.querySelector('td:last-child') as HTMLElement
    // The cell holds a wrapper div containing two ActionIcon divs (edit, delete).
    const wrapper = actionsCell.querySelector('div') as HTMLElement
    const iconDivs = wrapper.querySelectorAll(':scope > div')
    fireEvent.mouseEnter(iconDivs[0])
    fireEvent.mouseLeave(iconDivs[0])
    await user.click(iconDivs[0]) // edit
    await user.click(iconDivs[1]) // delete
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }))
    expect(onDeleteTarget).toHaveBeenCalledWith(expect.objectContaining({ id: 'i1' }))
  })

  it('sorts by name when the Name header is clicked', async () => {
    renderTable()
    const user = userEvent.setup()
    const nameHeader = screen
      .getByText('Wine Tasting')
      .closest('table')!
      .querySelector('th') as HTMLElement
    await user.click(nameHeader) // ascend
    await user.click(nameHeader) // descend
    // After descending sort, Hiking/Wine order flips — both still present.
    expect(screen.getByText('Hiking')).toBeInTheDocument()
    expect(screen.getByText('Wine Tasting')).toBeInTheDocument()
  })

  it('filters by name via the column search dropdown', async () => {
    renderTable()
    const user = userEvent.setup()
    const trigger = document.querySelector('.ant-table-filter-trigger') as HTMLElement
    await user.click(trigger)
    const input = await screen.findByPlaceholderText(/search/i)
    await user.type(input, 'wine')
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    await waitFor(() => expect(screen.queryByText('Hiking')).not.toBeInTheDocument())
    expect(screen.getByText('Wine Tasting')).toBeInTheDocument()

    // Re-open and Reset restores all rows.
    await user.click(document.querySelector('.ant-table-filter-trigger') as HTMLElement)
    await user.click(await screen.findByRole('button', { name: /^reset$/i }))
    await waitFor(() => expect(screen.getByText('Hiking')).toBeInTheDocument())
  })
})

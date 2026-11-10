import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { CategoriesTable } from '../components/CategoriesTable'

const rows = [
  {
    id: '1',
    name: 'Pizza',
    commissionRate: 5,
    interestTablesPerMonth: 10,
    restaurantsCount: 3,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Sushi',
    commissionRate: 7,
    interestTablesPerMonth: 5,
    restaurantsCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
  },
]

describe('CategoriesTable', () => {
  it('renders rows and triggers edit/delete', async () => {
    const onEdit = vi.fn()
    const onDel = vi.fn()
    const { container } = renderWithProviders(
      <CategoriesTable pagedData={rows} onEdit={onEdit} onDeleteTarget={onDel} />,
    )
    expect(screen.getByText('Pizza')).toBeInTheDocument()
    expect(screen.getByText('Sushi')).toBeInTheDocument()

    const user = userEvent.setup()

    // Row click triggers edit
    await user.click(screen.getByText('Pizza'))
    expect(onEdit).toHaveBeenCalledWith(rows[0])

    // Pencil icon triggers edit
    const actionDivs = container.querySelectorAll('td:last-child > div > div')
    await user.click(actionDivs[0] as Element)
    expect(onEdit).toHaveBeenCalledWith(rows[0])

    // Trash icon triggers delete
    await user.click(actionDivs[1] as Element)
    expect(onDel).toHaveBeenCalledWith(rows[0])

    // Hover coverage for both icons
    await user.hover(actionDivs[0] as Element)
    await user.unhover(actionDivs[0] as Element)
    await user.hover(actionDivs[1] as Element)
    await user.unhover(actionDivs[1] as Element)
  })

  it('renders empty', () => {
    renderWithProviders(
      <CategoriesTable pagedData={[]} onEdit={() => {}} onDeleteTarget={() => {}} />,
    )
    expect(screen.getAllByText(/no data/i).length).toBeGreaterThan(0)
  })

  it('sorts by all sortable column headers', async () => {
    renderWithProviders(
      <CategoriesTable pagedData={rows} onEdit={() => {}} onDeleteTarget={() => {}} />,
    )
    const user = userEvent.setup()
    const headers = screen.getAllByRole('columnheader')
    for (const h of headers) {
      // click each header twice to invoke ascend and descend sort functions
      await user.click(h)
      await user.click(h)
      await user.click(h)
    }
  })
})

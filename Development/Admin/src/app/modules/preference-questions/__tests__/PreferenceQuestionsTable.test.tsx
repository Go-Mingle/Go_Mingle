import { describe, it, expect, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'
import { PreferenceQuestionsTable } from '../components/PreferenceQuestionsTable'
import type { PreferenceQuestionListItem } from '../types'

const pagedData: PreferenceQuestionListItem[] = [
  {
    id: 'pq1',
    question: 'How often do you eat out?',
    type: 'MULTI_SELECT',
    questionOrder: 1,
    optionsCount: 5,
    createdAt: '2026-01-12T00:00:00.000Z',
  },
]

function renderTable(overrides: Partial<Parameters<typeof PreferenceQuestionsTable>[0]> = {}) {
  const onSort = vi.fn()
  const onRowClick = vi.fn()
  const onDeleteTarget = vi.fn()
  const onSearch = vi.fn()
  return {
    onSort,
    onRowClick,
    onDeleteTarget,
    onSearch,
    ...renderWithProviders(
      <PreferenceQuestionsTable
        pagedData={pagedData}
        sortBy="order"
        sortOrder="asc"
        searchValue=""
        onSort={onSort}
        onRowClick={onRowClick}
        onDeleteTarget={onDeleteTarget}
        onSearch={onSearch}
        emptyText=""
        {...overrides}
      />,
    ),
  }
}

describe('PreferenceQuestionsTable', () => {
  it('calls onSearch with the typed value from the question column filter', async () => {
    const { onSearch } = renderTable()
    const user = userEvent.setup()
    await user.click(document.querySelector('.ant-table-filter-trigger') as HTMLElement)
    const input = await screen.findByPlaceholderText('Search questions…')
    await user.type(input, 'eat')
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    expect(onSearch).toHaveBeenCalledWith('eat')
  })

  it('calls onSearch with an empty string when the filter is reset', async () => {
    const { onSearch } = renderTable({ searchValue: 'eat' })
    const user = userEvent.setup()
    await user.click(document.querySelector('.ant-table-filter-trigger') as HTMLElement)
    await user.click(await screen.findByRole('button', { name: /^reset$/i }))
    expect(onSearch).toHaveBeenCalledWith('')
  })

  it('sorts by the order and question columns', async () => {
    const { onSort } = renderTable()
    const user = userEvent.setup()
    const orderHeader = screen.getByRole('columnheader', { name: 'Order' })
    await user.click(within(orderHeader).getByText('Order'))
    expect(onSort).toHaveBeenCalledWith('order', 'desc')

    const questionHeader = screen.getByRole('columnheader', { name: 'Question' })
    await user.click(within(questionHeader).getByText('Question'))
    expect(onSort).toHaveBeenCalledWith('question', 'asc')
  })

  it('clicking a row triggers onRowClick with the record', async () => {
    const { onRowClick } = renderTable()
    const user = userEvent.setup()
    await user.click(screen.getByText('How often do you eat out?'))
    expect(onRowClick).toHaveBeenCalledWith(pagedData[0])
  })
})

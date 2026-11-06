import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FilterDropdownProps } from 'antd/es/table/interface'
import { renderWithProviders } from '../../../test-utils/renderWithProviders'
import { TableColumnSearchFilter } from '../TableColumnSearchFilter'

function makeProps(overrides: Partial<FilterDropdownProps> = {}): FilterDropdownProps {
  return {
    prefixCls: 'ant-table-filter',
    setSelectedKeys: vi.fn(),
    selectedKeys: [],
    confirm: vi.fn(),
    clearFilters: vi.fn(),
    filters: [],
    visible: true,
    close: vi.fn(),
    ...overrides,
  }
}

describe('TableColumnSearchFilter', () => {
  it('renders the placeholder with an empty input when no key is selected', () => {
    renderWithProviders(<TableColumnSearchFilter {...makeProps()} placeholder="Search names" />)
    const input = screen.getByPlaceholderText('Search names') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('renders the current selected key as the input value', () => {
    renderWithProviders(
      <TableColumnSearchFilter {...makeProps({ selectedKeys: ['abc'] })} placeholder="Search" />,
    )
    const input = screen.getByPlaceholderText('Search') as HTMLInputElement
    expect(input.value).toBe('abc')
  })

  it('calls setSelectedKeys with the typed value and an empty array when cleared', async () => {
    const setSelectedKeys = vi.fn()
    renderWithProviders(
      <TableColumnSearchFilter
        {...makeProps({ setSelectedKeys, selectedKeys: ['a'] })}
        placeholder="Search"
      />,
    )
    const input = screen.getByPlaceholderText('Search')
    const user = userEvent.setup()
    await user.type(input, 'b')
    expect(setSelectedKeys).toHaveBeenCalledWith(['ab'])
    await user.clear(input)
    expect(setSelectedKeys).toHaveBeenLastCalledWith([])
  })

  it('confirms the filter when Enter is pressed', async () => {
    const confirm = vi.fn()
    renderWithProviders(
      <TableColumnSearchFilter {...makeProps({ confirm })} placeholder="Search" />,
    )
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Search'), '{Enter}')
    expect(confirm).toHaveBeenCalled()
  })

  it('confirms the filter when the Search button is clicked', async () => {
    const confirm = vi.fn()
    renderWithProviders(
      <TableColumnSearchFilter {...makeProps({ confirm })} placeholder="Search" />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^search$/i }))
    expect(confirm).toHaveBeenCalled()
  })

  it('clears filters and confirms when Reset is clicked', async () => {
    const confirm = vi.fn()
    const clearFilters = vi.fn()
    renderWithProviders(
      <TableColumnSearchFilter {...makeProps({ confirm, clearFilters })} placeholder="Search" />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^reset$/i }))
    expect(clearFilters).toHaveBeenCalled()
    expect(confirm).toHaveBeenCalled()
  })

  it('does not throw when clearFilters is undefined and Reset is clicked', async () => {
    const confirm = vi.fn()
    renderWithProviders(
      <TableColumnSearchFilter
        {...makeProps({ confirm, clearFilters: undefined })}
        placeholder="Search"
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^reset$/i }))
    expect(confirm).toHaveBeenCalled()
  })
})

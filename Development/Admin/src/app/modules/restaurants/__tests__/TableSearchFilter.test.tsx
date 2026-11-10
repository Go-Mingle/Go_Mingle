import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { FilterDropdownProps } from 'antd/es/table/interface'
import { TableSearchFilter } from '../components/TableSearchFilter'

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

describe('TableSearchFilter', () => {
  it('renders the placeholder and an empty input when no key is selected', () => {
    render(<TableSearchFilter {...makeProps()} placeholder="Search names" />)
    const input = screen.getByPlaceholderText('Search names') as HTMLInputElement
    expect(input.value).toBe('')
  })

  it('renders the current selected key as the input value', () => {
    render(<TableSearchFilter {...makeProps({ selectedKeys: ['abc'] })} placeholder="Search" />)
    const input = screen.getByPlaceholderText('Search') as HTMLInputElement
    expect(input.value).toBe('abc')
  })

  it('calls setSelectedKeys with the typed value on change', async () => {
    const setSelectedKeys = vi.fn()
    render(<TableSearchFilter {...makeProps({ setSelectedKeys })} placeholder="Search" />)
    const input = screen.getByPlaceholderText('Search')
    const user = userEvent.setup()
    await user.type(input, 'a')
    expect(setSelectedKeys).toHaveBeenCalledWith(['a'])
  })

  it('calls setSelectedKeys with an empty array when the input is cleared', async () => {
    const setSelectedKeys = vi.fn()
    render(
      <TableSearchFilter
        {...makeProps({ setSelectedKeys, selectedKeys: ['abc'] })}
        placeholder="Search"
      />,
    )
    const input = screen.getByPlaceholderText('Search')
    const user = userEvent.setup()
    await user.clear(input)
    expect(setSelectedKeys).toHaveBeenLastCalledWith([])
  })

  it('confirms the filter when Enter is pressed', async () => {
    const confirm = vi.fn()
    render(<TableSearchFilter {...makeProps({ confirm })} placeholder="Search" />)
    const input = screen.getByPlaceholderText('Search')
    const user = userEvent.setup()
    await user.type(input, '{Enter}')
    expect(confirm).toHaveBeenCalled()
  })

  it('confirms the filter when the Search button is clicked', async () => {
    const confirm = vi.fn()
    render(<TableSearchFilter {...makeProps({ confirm })} placeholder="Search" />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Search'))
    expect(confirm).toHaveBeenCalled()
  })

  it('clears filters and confirms when Reset is clicked', async () => {
    const confirm = vi.fn()
    const clearFilters = vi.fn()
    render(<TableSearchFilter {...makeProps({ confirm, clearFilters })} placeholder="Search" />)
    const user = userEvent.setup()
    await user.click(screen.getByText('Reset'))
    expect(clearFilters).toHaveBeenCalled()
    expect(confirm).toHaveBeenCalled()
  })

  it('does not throw when clearFilters is undefined and Reset is clicked', async () => {
    const confirm = vi.fn()
    render(
      <TableSearchFilter
        {...makeProps({ confirm, clearFilters: undefined })}
        placeholder="Search"
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByText('Reset'))
    expect(confirm).toHaveBeenCalled()
  })

  it('toggles the search button background on hover and unhover', async () => {
    render(<TableSearchFilter {...makeProps()} placeholder="Search" />)
    const searchButton = screen.getByText('Search')
    const user = userEvent.setup()
    await user.hover(searchButton)
    expect(searchButton).toHaveStyle({ background: 'var(--color-accent-dark)' })
    await user.unhover(searchButton)
    expect(searchButton).toHaveStyle({ background: 'var(--color-accent)' })
  })
})

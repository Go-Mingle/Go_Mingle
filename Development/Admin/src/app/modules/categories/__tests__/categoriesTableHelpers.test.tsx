import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { makeSearchFilter } from '../components/categoriesTableHelpers'

describe('categoriesTableHelpers makeSearchFilter', () => {
  const filter = makeSearchFilter('Search…', 'name')

  it('typing updates keys and Enter confirms', async () => {
    const setSelectedKeys = vi.fn()
    const confirm = vi.fn()
    const clearFilters = vi.fn()
    const Dropdown = filter.filterDropdown
    render(
      <Dropdown
        setSelectedKeys={setSelectedKeys}
        selectedKeys={[]}
        confirm={confirm}
        clearFilters={clearFilters}
      />,
    )
    const user = userEvent.setup()
    await user.type(screen.getByPlaceholderText('Search…'), 'a')
    expect(setSelectedKeys).toHaveBeenCalledWith(['a'])
    await user.keyboard('{Enter}')
    expect(confirm).toHaveBeenCalled()
  })

  it('Reset and Search buttons', async () => {
    const Dropdown = filter.filterDropdown
    const confirm = vi.fn()
    const clearFilters = vi.fn()
    render(
      <Dropdown
        setSelectedKeys={vi.fn()}
        selectedKeys={['x']}
        confirm={confirm}
        clearFilters={clearFilters}
      />,
    )
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /reset/i }))
    expect(clearFilters).toHaveBeenCalled()
    await user.click(screen.getByText('Search'))
    // Hover/leave for coverage
    const searchBtn = screen.getByText('Search')
    await user.hover(searchBtn)
    await user.unhover(searchBtn)
  })

  it('clears keys when input emptied', async () => {
    const Dropdown = filter.filterDropdown
    const setSelectedKeys = vi.fn()
    render(
      <Dropdown
        setSelectedKeys={setSelectedKeys}
        selectedKeys={['abc']}
        confirm={vi.fn()}
        clearFilters={vi.fn()}
      />,
    )
    const user = userEvent.setup()
    await user.clear(screen.getByPlaceholderText('Search…'))
    expect(setSelectedKeys).toHaveBeenLastCalledWith([])
  })

  it('filterIcon renders both states', () => {
    const { container: c1 } = render(<>{filter.filterIcon(true)}</>)
    const { container: c2 } = render(<>{filter.filterIcon(false)}</>)
    expect(c1.querySelector('svg')).toBeInTheDocument()
    expect(c2.querySelector('svg')).toBeInTheDocument()
  })

  it('onFilter matches case-insensitively', () => {
    expect(filter.onFilter('foo', { name: 'FOOBAR' } as never)).toBe(true)
    expect(filter.onFilter('xyz', { name: 'FOOBAR' } as never)).toBe(false)
    expect(filter.onFilter('a', { name: '' } as never)).toBe(false)
  })

  it('Reset handles undefined clearFilters', async () => {
    const Dropdown = filter.filterDropdown
    const confirm = vi.fn()
    render(
      <Dropdown
        setSelectedKeys={vi.fn()}
        selectedKeys={[]}
        confirm={confirm}
        clearFilters={undefined}
      />,
    )
    await userEvent.setup().click(screen.getByRole('button', { name: /reset/i }))
    expect(confirm).toHaveBeenCalled()
  })
})

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  ACTION_CONFIG,
  tableSortIcon,
  funnelIcon,
  makeSearchFilter,
} from '../components/changeLogTableHelpers'

describe('changeLogTableHelpers', () => {
  it('ACTION_CONFIG has known actions', () => {
    expect(ACTION_CONFIG.create.label).toBe('Create')
    expect(ACTION_CONFIG.update.label).toBe('Update')
    expect(ACTION_CONFIG.delete.label).toBe('Delete')
  })

  it('tableSortIcon renders different icons for sort orders', () => {
    const { container: c1 } = render(<>{tableSortIcon({ sortOrder: 'ascend' })}</>)
    expect(c1.querySelector('svg')).toBeInTheDocument()
    const { container: c2 } = render(<>{tableSortIcon({ sortOrder: 'descend' })}</>)
    expect(c2.querySelector('svg')).toBeInTheDocument()
    const { container: c3 } = render(<>{tableSortIcon({ sortOrder: null })}</>)
    expect(c3.querySelector('svg')).toBeInTheDocument()
  })

  it('funnelIcon renders filtered and unfiltered variants', () => {
    const { container: c1 } = render(<>{funnelIcon(true)}</>)
    const { container: c2 } = render(<>{funnelIcon(false)}</>)
    expect(c1.querySelector('svg')).toBeInTheDocument()
    expect(c2.querySelector('svg')).toBeInTheDocument()
  })

  describe('makeSearchFilter', () => {
    const filter = makeSearchFilter('Search…', 'admin')

    it('renders dropdown, typing updates keys, Enter confirms', async () => {
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
      const input = screen.getByPlaceholderText('Search…')
      await user.type(input, 'a')
      expect(setSelectedKeys).toHaveBeenCalledWith(['a'])
      await user.keyboard('{Enter}')
      expect(confirm).toHaveBeenCalled()
    })

    it('Reset clears filters then confirms; Search confirms', async () => {
      const setSelectedKeys = vi.fn()
      const confirm = vi.fn()
      const clearFilters = vi.fn()
      const Dropdown = filter.filterDropdown
      render(
        <Dropdown
          setSelectedKeys={setSelectedKeys}
          selectedKeys={['x']}
          confirm={confirm}
          clearFilters={clearFilters}
        />,
      )
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /reset/i }))
      expect(clearFilters).toHaveBeenCalled()
      expect(confirm).toHaveBeenCalledTimes(1)
      await user.click(screen.getByText('Search'))
      expect(confirm).toHaveBeenCalledTimes(2)
    })

    it('clears selected keys when input emptied', async () => {
      const setSelectedKeys = vi.fn()
      const Dropdown = filter.filterDropdown
      render(
        <Dropdown
          setSelectedKeys={setSelectedKeys}
          selectedKeys={['abc']}
          confirm={vi.fn()}
          clearFilters={vi.fn()}
        />,
      )
      const user = userEvent.setup()
      const input = screen.getByPlaceholderText('Search…') as HTMLInputElement
      await user.clear(input)
      // clearing emits onChange with empty string; helper sets [] when value empty
      expect(setSelectedKeys).toHaveBeenLastCalledWith([])
    })

    it('filterIcon renders both states', () => {
      const { container: c1 } = render(<>{filter.filterIcon(true)}</>)
      const { container: c2 } = render(<>{filter.filterIcon(false)}</>)
      expect(c1.querySelector('svg')).toBeInTheDocument()
      expect(c2.querySelector('svg')).toBeInTheDocument()
    })

    it('onFilter matches case-insensitively and falls back to empty', () => {
      expect(filter.onFilter('foo', { admin: 'FOOBAR' })).toBe(true)
      expect(filter.onFilter('xyz', { admin: 'FOOBAR' })).toBe(false)
      expect(filter.onFilter('a', { admin: undefined })).toBe(false)
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
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /reset/i }))
      expect(confirm).toHaveBeenCalled()
    })
  })
})

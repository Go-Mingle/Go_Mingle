import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  dateRangeFilterDropdown,
  dateFilterIcon,
  funnelIcon,
} from '../components/financeFilterHelpers'

describe('financeFilterHelpers', () => {
  it('tableSortIcon all three states', () => {
    expect(
      render(<>{tableSortIcon({ sortOrder: 'ascend' })}</>).container.querySelector('svg'),
    ).toBeInTheDocument()
    expect(
      render(<>{tableSortIcon({ sortOrder: 'descend' })}</>).container.querySelector('svg'),
    ).toBeInTheDocument()
    expect(
      render(<>{tableSortIcon({ sortOrder: null })}</>).container.querySelector('svg'),
    ).toBeInTheDocument()
  })

  it.each([searchFilterIcon, dateFilterIcon, funnelIcon])('icon: filtered states', (fn) => {
    expect(render(<>{fn(true)}</>).container.querySelector('svg')).toBeInTheDocument()
    expect(render(<>{fn(false)}</>).container.querySelector('svg')).toBeInTheDocument()
  })

  describe('searchFilterDropdown', () => {
    const Dropdown = searchFilterDropdown('Search…')

    it('typing, reset, search interactions', async () => {
      const setSelectedKeys = vi.fn()
      const confirm = vi.fn()
      const clearFilters = vi.fn()
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
      await user.click(screen.getByRole('button', { name: /reset/i }))
      expect(clearFilters).toHaveBeenCalled()
      const search = screen.getByText('Search')
      await user.click(search)
      await user.hover(search)
      await user.unhover(search)
    })

    it('clearing input emits empty', async () => {
      const setSelectedKeys = vi.fn()
      render(
        <Dropdown
          setSelectedKeys={setSelectedKeys}
          selectedKeys={['x']}
          confirm={vi.fn()}
          clearFilters={vi.fn()}
        />,
      )
      await userEvent.setup().clear(screen.getByPlaceholderText('Search…'))
      expect(setSelectedKeys).toHaveBeenLastCalledWith([])
    })

    it('undefined clearFilters does not crash', async () => {
      render(
        <Dropdown
          setSelectedKeys={vi.fn()}
          selectedKeys={[]}
          confirm={vi.fn()}
          clearFilters={undefined}
        />,
      )
      await userEvent.setup().click(screen.getByRole('button', { name: /reset/i }))
    })
  })

  describe('dateRangeFilterDropdown', () => {
    it('renders and reset/apply work', async () => {
      const setSelectedKeys = vi.fn()
      const confirm = vi.fn()
      const clearFilters = vi.fn()
      render(
        dateRangeFilterDropdown({
          setSelectedKeys,
          selectedKeys: [],
          confirm,
          clearFilters,
        }),
      )
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /reset/i }))
      expect(clearFilters).toHaveBeenCalled()
      const apply = screen.getByText('Apply')
      await user.click(apply)
      await user.hover(apply)
      await user.unhover(apply)
    })

    it('undefined clearFilters fallback', async () => {
      render(
        dateRangeFilterDropdown({
          setSelectedKeys: vi.fn(),
          selectedKeys: [],
          confirm: vi.fn(),
          clearFilters: undefined,
        }),
      )
      await userEvent.setup().click(screen.getByRole('button', { name: /reset/i }))
    })
  })
})

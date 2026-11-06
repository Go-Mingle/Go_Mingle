import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  dateRangeFilterDropdown,
  dateFilterIcon,
  userStatusColours,
  LABEL_STYLE,
} from '../components/tableHelpers'

describe('users tableHelpers', () => {
  it('exports constants', () => {
    expect(userStatusColours.ACTIVE.bg).toBeTruthy()
    expect(LABEL_STYLE).toBeDefined()
  })

  it('tableSortIcon all states', () => {
    ;(['ascend', 'descend', null] as const).forEach((s) => {
      const { container } = render(<>{tableSortIcon({ sortOrder: s })}</>)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })

  it.each([searchFilterIcon, dateFilterIcon])('icons render both states', (fn) => {
    expect(render(<>{fn(true)}</>).container.querySelector('svg')).toBeInTheDocument()
    expect(render(<>{fn(false)}</>).container.querySelector('svg')).toBeInTheDocument()
  })

  describe('searchFilterDropdown', () => {
    const D = searchFilterDropdown('Search…')

    it('interactions', async () => {
      const setSelectedKeys = vi.fn()
      const confirm = vi.fn()
      const clearFilters = vi.fn()
      render(
        <D
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
      await user.click(screen.getByRole('button', { name: /reset/i }))
      const search = screen.getByText('Search')
      await user.click(search)
      await user.hover(search)
      await user.unhover(search)
    })

    it('reset with undefined clearFilters', async () => {
      render(
        <D
          setSelectedKeys={vi.fn()}
          selectedKeys={[]}
          confirm={vi.fn()}
          clearFilters={undefined}
        />,
      )
      await userEvent.setup().click(screen.getByRole('button', { name: /reset/i }))
    })

    it('clearing emits empty', async () => {
      const setSelectedKeys = vi.fn()
      render(
        <D
          setSelectedKeys={setSelectedKeys}
          selectedKeys={['x']}
          confirm={vi.fn()}
          clearFilters={vi.fn()}
        />,
      )
      await userEvent.setup().clear(screen.getByPlaceholderText('Search…'))
      expect(setSelectedKeys).toHaveBeenLastCalledWith([])
    })
  })

  describe('dateRangeFilterDropdown', () => {
    it('renders reset and apply', async () => {
      const clearFilters = vi.fn()
      render(
        dateRangeFilterDropdown({
          setSelectedKeys: vi.fn(),
          selectedKeys: [],
          confirm: vi.fn(),
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

    it('reset with undefined clearFilters', async () => {
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

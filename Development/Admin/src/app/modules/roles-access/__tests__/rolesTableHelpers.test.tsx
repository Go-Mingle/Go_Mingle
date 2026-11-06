import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  ALL_MODULES,
  moduleColours,
  defaultModuleColour,
} from '../components/rolesTableHelpers'

describe('rolesTableHelpers', () => {
  it('ALL_MODULES is non-empty', () => {
    expect(ALL_MODULES.length).toBeGreaterThan(0)
  })

  it('moduleColours uses a neutral default for every module', () => {
    // Map is intentionally empty — every label resolves to defaultModuleColour.
    expect(Object.keys(moduleColours)).toHaveLength(0)
    expect(defaultModuleColour).toBeDefined()
    expect(defaultModuleColour.bg).toBeTruthy()
    expect(defaultModuleColour.text).toBeTruthy()
  })

  it('tableSortIcon renders all three states', () => {
    const { container: c1 } = render(<>{tableSortIcon({ sortOrder: 'ascend' })}</>)
    const { container: c2 } = render(<>{tableSortIcon({ sortOrder: 'descend' })}</>)
    const { container: c3 } = render(<>{tableSortIcon({ sortOrder: null })}</>)
    expect(c1.querySelector('svg')).toBeInTheDocument()
    expect(c2.querySelector('svg')).toBeInTheDocument()
    expect(c3.querySelector('svg')).toBeInTheDocument()
  })

  it('searchFilterIcon renders both states', () => {
    expect(render(<>{searchFilterIcon(true)}</>).container.querySelector('svg')).toBeInTheDocument()
    expect(
      render(<>{searchFilterIcon(false)}</>).container.querySelector('svg'),
    ).toBeInTheDocument()
  })

  describe('searchFilterDropdown', () => {
    const Dropdown = searchFilterDropdown('Search…')

    it('typing updates keys and Enter confirms', async () => {
      const setSelectedKeys = vi.fn()
      const confirm = vi.fn()
      render(
        <Dropdown
          setSelectedKeys={setSelectedKeys}
          selectedKeys={[]}
          confirm={confirm}
          clearFilters={vi.fn()}
        />,
      )
      const user = userEvent.setup()
      await user.type(screen.getByPlaceholderText('Search…'), 'a')
      expect(setSelectedKeys).toHaveBeenCalledWith(['a'])
      await user.keyboard('{Enter}')
      expect(confirm).toHaveBeenCalled()
    })

    it('Reset clears filters and confirms', async () => {
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
      expect(confirm).toHaveBeenCalled()
    })

    it('Search confirms', async () => {
      const confirm = vi.fn()
      render(
        <Dropdown
          setSelectedKeys={vi.fn()}
          selectedKeys={['x']}
          confirm={confirm}
          clearFilters={vi.fn()}
        />,
      )
      const user = userEvent.setup()
      const searchBtn = screen.getByText('Search')
      await user.click(searchBtn)
      await user.hover(searchBtn)
      await user.unhover(searchBtn)
      expect(confirm).toHaveBeenCalled()
    })

    it('Reset with undefined clearFilters works', async () => {
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

    it('Clearing input emits empty keys', async () => {
      const setSelectedKeys = vi.fn()
      render(
        <Dropdown
          setSelectedKeys={setSelectedKeys}
          selectedKeys={['abc']}
          confirm={vi.fn()}
          clearFilters={vi.fn()}
        />,
      )
      await userEvent.setup().clear(screen.getByPlaceholderText('Search…'))
      expect(setSelectedKeys).toHaveBeenLastCalledWith([])
    })
  })
})

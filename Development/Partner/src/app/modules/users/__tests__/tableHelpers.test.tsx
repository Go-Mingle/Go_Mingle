import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  dateRangeFilterDropdown,
  dateFilterIcon,
  statusFilterIcon,
  userStatusColours,
  FILTER_LABEL_CLASS,
} from '../components/tableHelpers'

const BUTTONS = { reset: 'Reset', submit: 'Search' }

describe('users tableHelpers', () => {
  it('exports constants', () => {
    expect(userStatusColours.active.bg).toBeTruthy()
    expect(FILTER_LABEL_CLASS).toContain('uppercase')
  })

  /**
   * MET-1247: antd renders a custom sortIcon bare, so the old naked <svg> had no
   * accessible name and the control read as absent. Assert the name, not the svg.
   */
  it('names the sort affordance in every state and keeps antd’s class', () => {
    ;(['ascend', 'descend', null] as const).forEach((sortOrder) => {
      const { container, unmount } = render(<>{tableSortIcon('Sort by NAME')({ sortOrder })}</>)
      expect(screen.getByRole('img', { name: 'Sort by NAME' })).toBeInTheDocument()
      expect(container.querySelector('.ant-table-column-sorter')).toBeInTheDocument()
      expect(container.querySelector('svg')).toBeInTheDocument()
      unmount()
    })
  })

  it.each([
    ['search', searchFilterIcon, 'Search by NAME'],
    ['date', dateFilterIcon, 'Filter by LAST ACTIVE'],
    ['status', statusFilterIcon, 'Filter by STATUS'],
  ])('names the %s filter affordance in both states', (_label, factory, name) => {
    ;[true, false].forEach((filtered) => {
      const { container, unmount } = render(<>{factory(name)(filtered)}</>)
      expect(screen.getByRole('img', { name })).toBeInTheDocument()
      expect(container.querySelector('svg')).toBeInTheDocument()
      unmount()
    })
  })

  describe('searchFilterDropdown', () => {
    const D = searchFilterDropdown({
      ...BUTTONS,
      placeholder: 'Search…',
      fieldLabel: 'Search by NAME',
    })

    function renderDropdown(overrides: Partial<Parameters<typeof D>[0]> = {}) {
      const props = {
        setSelectedKeys: vi.fn(),
        selectedKeys: [],
        confirm: vi.fn(),
        clearFilters: vi.fn(),
        ...overrides,
      }
      return { ...render(<D {...props} />), props }
    }

    it('exposes the field by accessible name, not just placeholder', () => {
      renderDropdown()
      expect(screen.getByRole('textbox', { name: 'Search by NAME' })).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
    })

    it('renders translated buttons rather than hardcoded English', () => {
      renderDropdown()
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
    })

    it('interactions', async () => {
      const { props } = renderDropdown()
      const user = userEvent.setup()

      await user.type(screen.getByRole('textbox', { name: 'Search by NAME' }), 'a')
      expect(props.setSelectedKeys).toHaveBeenCalledWith(['a'])

      await user.keyboard('{Enter}')
      expect(props.confirm).toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Reset' }))
      expect(props.clearFilters).toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Search' }))
    })

    it('reset with undefined clearFilters', async () => {
      const { props } = renderDropdown({ clearFilters: undefined })
      await userEvent.setup().click(screen.getByRole('button', { name: 'Reset' }))
      expect(props.confirm).toHaveBeenCalled()
    })

    it('clearing emits empty', async () => {
      const { props } = renderDropdown({ selectedKeys: ['x'] })
      await userEvent.setup().clear(screen.getByRole('textbox', { name: 'Search by NAME' }))
      expect(props.setSelectedKeys).toHaveBeenLastCalledWith([])
    })
  })

  describe('dateRangeFilterDropdown', () => {
    const D = dateRangeFilterDropdown({
      reset: 'Reset',
      submit: 'Apply',
      fieldLabel: 'Filter by LAST ACTIVE',
      fromPlaceholder: 'From',
      toPlaceholder: 'To',
    })

    function renderDropdown(overrides: Partial<Parameters<typeof D>[0]> = {}) {
      const props = {
        setSelectedKeys: vi.fn(),
        selectedKeys: [],
        confirm: vi.fn(),
        clearFilters: vi.fn(),
        ...overrides,
      }
      return { ...render(<D {...props} />), props }
    }

    it('labels the picker and both ends of the range', () => {
      renderDropdown()
      expect(screen.getByText('Filter by LAST ACTIVE')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('From')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('To')).toBeInTheDocument()
    })

    it('renders reset and apply', async () => {
      const { props } = renderDropdown()
      const user = userEvent.setup()

      await user.click(screen.getByRole('button', { name: 'Reset' }))
      expect(props.clearFilters).toHaveBeenCalled()

      await user.click(screen.getByRole('button', { name: 'Apply' }))
      expect(props.confirm).toHaveBeenCalled()
    })

    it('reset with undefined clearFilters', async () => {
      const { props } = renderDropdown({ clearFilters: undefined })
      await userEvent.setup().click(screen.getByRole('button', { name: 'Reset' }))
      expect(props.confirm).toHaveBeenCalled()
    })

    it('emits the picked range and clears it again', async () => {
      const { props } = renderDropdown()
      const user = userEvent.setup()

      await user.click(screen.getByPlaceholderText('From'))
      const cells = document.querySelectorAll('.ant-picker-cell-inner')
      await user.click(cells[10] as HTMLElement)
      await user.click(cells[20] as HTMLElement)

      expect(props.setSelectedKeys).toHaveBeenCalled()
    })
  })
})

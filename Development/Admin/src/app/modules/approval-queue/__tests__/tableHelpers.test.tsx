import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  tableSortIcon,
  searchFilterDropdown,
  searchFilterIcon,
  mapTableChange,
} from '../components/tableHelpers'

describe('tableSortIcon', () => {
  it('renders an icon for every sort state', () => {
    ;(['ascend', 'descend', null] as const).forEach((s) => {
      const { container } = render(<>{tableSortIcon({ sortOrder: s })}</>)
      expect(container.querySelector('svg')).toBeInTheDocument()
    })
  })
})

describe('searchFilterDropdown / searchFilterIcon', () => {
  it('handles typing, reset and search', async () => {
    const setSelectedKeys = vi.fn()
    const confirm = vi.fn()
    const clearFilters = vi.fn()
    const Dropdown = searchFilterDropdown('Search…')
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
    await user.click(screen.getByText('Search'))
  })

  it('clears keys when input is emptied and tolerates missing clearFilters', async () => {
    const setSelectedKeys = vi.fn()
    const Dropdown = searchFilterDropdown('Search…')
    render(
      <Dropdown
        setSelectedKeys={setSelectedKeys}
        selectedKeys={['x']}
        confirm={vi.fn()}
        clearFilters={undefined}
      />,
    )
    const user = userEvent.setup()
    await user.clear(screen.getByPlaceholderText('Search…'))
    expect(setSelectedKeys).toHaveBeenLastCalledWith([])
    await user.click(screen.getByRole('button', { name: /reset/i }))
  })

  it('renders the filter icon in both states', () => {
    expect(render(<>{searchFilterIcon(true)}</>).container.querySelector('svg')).toBeInTheDocument()
    expect(
      render(<>{searchFilterIcon(false)}</>).container.querySelector('svg'),
    ).toBeInTheDocument()
  })
})

describe('mapTableChange', () => {
  it('maps a restaurant search to the restaurant param', () => {
    const partial = mapTableChange({ name: ['wax'] }, {})
    expect(partial).toMatchObject({ restaurant: 'wax', owner: undefined })
  })

  it('maps an owner search to the owner param', () => {
    const partial = mapTableChange({ owner: ['farida'] }, {})
    expect(partial).toMatchObject({ owner: 'farida', restaurant: undefined })
  })

  it('maps a city search to the city param', () => {
    const partial = mapTableChange({ city: ['karachi'] }, {})
    expect(partial).toMatchObject({ city: 'karachi', restaurant: undefined, owner: undefined })
  })

  it('maps all three columns simultaneously', () => {
    const partial = mapTableChange({ name: ['wax'], owner: ['farida'], city: ['karachi'] }, {})
    expect(partial).toMatchObject({ restaurant: 'wax', owner: 'farida', city: 'karachi' })
  })

  it('clears search when no column filter is active', () => {
    const partial = mapTableChange({ name: null, owner: null, city: null }, {})
    expect(partial.restaurant).toBeUndefined()
    expect(partial.owner).toBeUndefined()
    expect(partial.city).toBeUndefined()
  })

  it('maps sorter field + order to sortBy + sortOrder', () => {
    expect(mapTableChange({}, { field: 'submitted', order: 'descend' })).toMatchObject({
      sortBy: 'submittedAt',
      sortOrder: 'desc',
    })
    expect(mapTableChange({}, { field: 'name', order: 'ascend' })).toMatchObject({
      sortBy: 'restaurant',
      sortOrder: 'asc',
    })
  })

  it('clears sort when order is absent or sorter is an array', () => {
    expect(mapTableChange({}, { field: 'name', order: null }).sortBy).toBeUndefined()
    expect(mapTableChange({}, [{ field: 'name', order: 'ascend' }]).sortBy).toBeUndefined()
  })
})

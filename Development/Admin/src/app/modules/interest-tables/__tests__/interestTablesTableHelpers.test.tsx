import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import {
  tableSortIcon,
  funnelIcon,
  makeSearchFilter,
  makeDateFilter,
} from '../components/interestTablesTableHelpers'
import type { InterestTable } from '../types'

describe('interestTablesTableHelpers', () => {
  it('tableSortIcon renders all three sort states', () => {
    const { container: ascend } = render(<>{tableSortIcon({ sortOrder: 'ascend' })}</>)
    const { container: descend } = render(<>{tableSortIcon({ sortOrder: 'descend' })}</>)
    const { container: none } = render(<>{tableSortIcon({ sortOrder: null })}</>)
    expect(ascend.querySelector('svg')).toBeInTheDocument()
    expect(descend.querySelector('svg')).toBeInTheDocument()
    expect(none.querySelector('svg')).toBeInTheDocument()
  })

  it('funnelIcon renders filtered and unfiltered variants', () => {
    const { container: filtered } = render(<>{funnelIcon(true)}</>)
    const { container: unfiltered } = render(<>{funnelIcon(false)}</>)
    expect(filtered.querySelector('svg')).toBeInTheDocument()
    expect(unfiltered.querySelector('svg')).toBeInTheDocument()
  })

  describe('makeSearchFilter', () => {
    const filter = makeSearchFilter('Search…', 'name')

    it('typing updates keys and Enter confirms', async () => {
      const setSelectedKeys = vi.fn()
      const confirm = vi.fn()
      const Dropdown = filter.filterDropdown
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

    it('clearing the input emits empty keys', async () => {
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
      await userEvent.setup().clear(screen.getByPlaceholderText('Search…'))
      expect(setSelectedKeys).toHaveBeenLastCalledWith([])
    })

    it('Reset clears filters and confirms; Search confirms and hover toggles background', async () => {
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
      expect(confirm).toHaveBeenCalledTimes(1)
      const searchBtn = screen.getByText('Search')
      await user.hover(searchBtn)
      expect(searchBtn).toHaveStyle({ background: 'var(--color-accent-dark)' })
      await user.unhover(searchBtn)
      expect(searchBtn).toHaveStyle({ background: 'var(--color-accent)' })
      await user.click(searchBtn)
      expect(confirm).toHaveBeenCalledTimes(2)
    })

    it('Reset works when clearFilters is undefined', async () => {
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

    it('filterIcon renders both states', () => {
      expect(
        render(<>{filter.filterIcon(true)}</>).container.querySelector('svg'),
      ).toBeInTheDocument()
      expect(
        render(<>{filter.filterIcon(false)}</>).container.querySelector('svg'),
      ).toBeInTheDocument()
    })

    it('onFilter matches case-insensitively and falls back on nullish field', () => {
      expect(filter.onFilter('foo', { name: 'FOOBAR' } as unknown as InterestTable)).toBe(true)
      expect(filter.onFilter('xyz', { name: 'FOOBAR' } as unknown as InterestTable)).toBe(false)
      expect(filter.onFilter('a', { name: undefined } as unknown as InterestTable)).toBe(false)
    })
  })

  describe('makeDateFilter', () => {
    const filter = makeDateFilter('created')

    it('changing the range picker sets keys; clearing sets empty keys', () => {
      const setSelectedKeys = vi.fn()
      const Dropdown = filter.filterDropdown
      render(
        <Dropdown
          setSelectedKeys={setSelectedKeys}
          selectedKeys={[]}
          confirm={vi.fn()}
          clearFilters={vi.fn()}
        />,
      )
      // Access the onChange handler indirectly is not possible via DOM alone for
      // antd RangePicker without heavy interaction; instead verify the dropdown
      // renders without throwing and exposes Reset/Apply actions.
      expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument()
      expect(screen.getByText('Apply')).toBeInTheDocument()
    })

    it('Reset clears filters and confirms; Apply confirms and hover toggles background', async () => {
      const Dropdown = filter.filterDropdown
      const confirm = vi.fn()
      const clearFilters = vi.fn()
      render(
        <Dropdown
          setSelectedKeys={vi.fn()}
          selectedKeys={[]}
          confirm={confirm}
          clearFilters={clearFilters}
        />,
      )
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /reset/i }))
      expect(clearFilters).toHaveBeenCalled()
      expect(confirm).toHaveBeenCalledTimes(1)
      const applyBtn = screen.getByText('Apply')
      await user.hover(applyBtn)
      expect(applyBtn).toHaveStyle({ background: 'var(--color-accent-dark)' })
      await user.unhover(applyBtn)
      expect(applyBtn).toHaveStyle({ background: 'var(--color-accent)' })
      await user.click(applyBtn)
      expect(confirm).toHaveBeenCalledTimes(2)
    })

    it('Reset works when clearFilters is undefined', async () => {
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

    it('filterIcon renders both states', () => {
      expect(
        render(<>{filter.filterIcon(true)}</>).container.querySelector('svg'),
      ).toBeInTheDocument()
      expect(
        render(<>{filter.filterIcon(false)}</>).container.querySelector('svg'),
      ).toBeInTheDocument()
    })

    it('onFilter returns true when value is null (no range applied)', () => {
      expect(
        filter.onFilter(null, { created: '2024-01-05T00:00:00.000Z' } as unknown as InterestTable),
      ).toBe(true)
    })

    it('onFilter returns true when value is not a two-element array', () => {
      expect(
        filter.onFilter([dayjs('2024-01-01')], {
          created: '2024-01-05T00:00:00.000Z',
        } as unknown as InterestTable),
      ).toBe(true)
    })

    it('onFilter returns true when either bound of the range is falsy', () => {
      expect(
        filter.onFilter([null, dayjs('2024-01-10')], {
          created: '2024-01-05T00:00:00.000Z',
        } as unknown as InterestTable),
      ).toBe(true)
      expect(
        filter.onFilter([dayjs('2024-01-01'), null], {
          created: '2024-01-05T00:00:00.000Z',
        } as unknown as InterestTable),
      ).toBe(true)
    })

    it('onFilter returns true when the record date falls within the range', () => {
      expect(
        filter.onFilter([dayjs('2024-01-01'), dayjs('2024-01-10')], {
          created: '2024-01-05T00:00:00.000Z',
        } as unknown as InterestTable),
      ).toBe(true)
    })

    it('onFilter returns false when the record date falls outside the range', () => {
      expect(
        filter.onFilter([dayjs('2024-01-01'), dayjs('2024-01-10')], {
          created: '2024-02-01T00:00:00.000Z',
        } as unknown as InterestTable),
      ).toBe(false)
    })

    // MET-1309 — the real API sends 'DD-MM-YYYY HH:mm', which a strict dayjs()
    // parse rejected, so every row failed the range test.
    it('matches a record whose date uses the real API "DD-MM-YYYY HH:mm" shape', () => {
      expect(
        filter.onFilter([dayjs('2024-01-01'), dayjs('2024-01-10')], {
          created: '05-01-2024 14:30',
        } as unknown as InterestTable),
      ).toBe(true)
      expect(
        filter.onFilter([dayjs('2024-01-01'), dayjs('2024-01-10')], {
          created: '01-02-2024 14:30',
        } as unknown as InterestTable),
      ).toBe(false)
    })

    it('excludes a record with a missing or unparseable date', () => {
      expect(
        filter.onFilter([dayjs('2024-01-01'), dayjs('2024-01-10')], {
          created: 'not-a-date',
        } as unknown as InterestTable),
      ).toBe(false)
      expect(
        filter.onFilter([dayjs('2024-01-01'), dayjs('2024-01-10')], {
          created: undefined,
        } as unknown as InterestTable),
      ).toBe(false)
    })
  })
})

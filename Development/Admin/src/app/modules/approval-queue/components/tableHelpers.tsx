import type { Key } from 'react'
import { Input, Button } from 'antd'
import type { FilterValue, SorterResult } from 'antd/es/table/interface'
import { MagnifyingGlass, ArrowUp, ArrowDown, ArrowsDownUp } from '@phosphor-icons/react'
import type { Application, ListApprovalsQueryParams } from '../types'

export const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

interface FilterDropdownProps {
  setSelectedKeys: (keys: Key[]) => void
  selectedKeys: Key[]
  confirm: () => void
  clearFilters?: () => void
}

export const searchFilterDropdown =
  (placeholder: string) =>
  ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
    <div className="p-3 w-60">
      <Input
        autoFocus
        prefix={<MagnifyingGlass size={14} color="var(--color-text-subtle)" />}
        placeholder={placeholder}
        value={selectedKeys[0] as string}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        className="mb-2 rounded-xl"
      />
      <div className="flex gap-2 justify-end">
        <Button
          size="small"
          onClick={() => {
            clearFilters?.()
            confirm()
          }}
          className="border-(--color-border-strong) text-(--color-text-muted) rounded-xl"
        >
          Reset
        </Button>
        <button
          onClick={() => confirm()}
          className="h-7 px-3 bg-accent hover:bg-accent-dark text-white border-none rounded-xl text-xs font-semibold cursor-pointer transition-[background] duration-150 ease-out"
        >
          Search
        </button>
      </div>
    </div>
  )

export const searchFilterIcon = (filtered: boolean) => (
  <MagnifyingGlass
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    color={filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)'}
  />
)

const SORT_FIELD_MAP: Record<string, ListApprovalsQueryParams['sortBy']> = {
  name: 'restaurant',
  owner: 'owner',
  city: 'city',
  submitted: 'submittedAt',
}

/**
 * Translate AntD's `onChange` (filters + sorter) into the server-driven query
 * params. The Restaurant and Owner columns each map to their own param
 * (`restaurant` / `owner`) so both can filter simultaneously; sort is limited
 * to the whitelisted fields.
 */
export function mapTableChange(
  filters: Record<string, FilterValue | null>,
  sorter: SorterResult<Application> | SorterResult<Application>[],
): Partial<ListApprovalsQueryParams> {
  const partial: Partial<ListApprovalsQueryParams> = {}

  const nameQ = filters['name']
  const ownerQ = filters['owner']
  const cityQ = filters['city']
  partial.restaurant = nameQ && nameQ.length > 0 ? String(nameQ[0]) : undefined
  partial.owner = ownerQ && ownerQ.length > 0 ? String(ownerQ[0]) : undefined
  partial.city = cityQ && cityQ.length > 0 ? String(cityQ[0]) : undefined

  const s = sorter as SorterResult<Application>
  if (!Array.isArray(sorter) && s.field && s.order) {
    partial.sortBy = SORT_FIELD_MAP[String(s.field)]
    partial.sortOrder = s.order === 'descend' ? 'desc' : 'asc'
  } else {
    partial.sortBy = undefined
    partial.sortOrder = undefined
  }

  return partial
}

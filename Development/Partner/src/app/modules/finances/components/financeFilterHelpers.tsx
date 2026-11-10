import React from 'react'
import { Input, Button, DatePicker } from 'antd'
import {
  MagnifyingGlass,
  CalendarBlank,
  Funnel,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
} from '@phosphor-icons/react'
import dayjs from 'dayjs'

// ── Shared button styles ───────────────────────────────────────
export const accentBtnClass =
  'h-7 px-3 py-0 bg-[var(--color-accent)] hover:bg-[var(--color-accent-dark)] text-white border-none rounded-lg font-[Poppins,sans-serif] text-xs font-semibold cursor-pointer'

export const greyBtnClass =
  'border-[var(--color-border-strong)] text-[var(--color-text-muted)] rounded-lg'

// ── Sort icon ──────────────────────────────────────────────────
export const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

// ── Filter dropdown types ──────────────────────────────────────
export type FilterDropdownProps = {
  setSelectedKeys: (keys: React.Key[]) => void
  selectedKeys: React.Key[]
  confirm: () => void
  clearFilters?: () => void
}

// ── Search filter dropdown ─────────────────────────────────────
export const searchFilterDropdown =
  (placeholder: string) =>
  ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FilterDropdownProps) => (
    <div className="p-3 w-60">
      <Input
        autoFocus
        prefix={<MagnifyingGlass size={14} className="text-[var(--color-text-subtle)]" />}
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
          className={greyBtnClass}
        >
          Reset
        </Button>
        <button onClick={() => confirm()} className={accentBtnClass}>
          Search
        </button>
      </div>
    </div>
  )

export const searchFilterIcon = (filtered: boolean) => (
  <MagnifyingGlass
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
  />
)

// ── Date range filter dropdown ─────────────────────────────────
export const dateRangeFilterDropdown = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
}: FilterDropdownProps) => (
  <div className="p-3 w-[280px]">
    <DatePicker.RangePicker
      className="w-full mb-2"
      value={selectedKeys[0] as unknown as [dayjs.Dayjs, dayjs.Dayjs]}
      onChange={(dates) => setSelectedKeys(dates ? [dates as unknown as React.Key] : [])}
    />
    <div className="flex gap-2 justify-end">
      <Button
        size="small"
        onClick={() => {
          clearFilters?.()
          confirm()
        }}
        className={greyBtnClass}
      >
        Reset
      </Button>
      <button onClick={() => confirm()} className={accentBtnClass}>
        Apply
      </button>
    </div>
  </div>
)

export const dateFilterIcon = (filtered: boolean) => (
  <CalendarBlank
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
  />
)

export const funnelIcon = (filtered: boolean) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
  />
)

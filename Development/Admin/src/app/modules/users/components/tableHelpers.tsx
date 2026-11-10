import type { CSSProperties, Key } from 'react'
import type { Dayjs } from 'dayjs'
import { Input, Button, DatePicker } from 'antd'
import {
  MagnifyingGlass,
  CalendarBlank,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
} from '@phosphor-icons/react'

export const userStatusColours: Record<string, { bg: string }> = {
  ACTIVE: { bg: '#1A8A5A' },
  SUSPENDED: { bg: '#C0392B' },
}

export const LABEL_STYLE: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
}

export const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

interface FDP {
  setSelectedKeys: (keys: Key[]) => void
  selectedKeys: Key[]
  confirm: () => void
  clearFilters?: () => void
}

export const searchFilterDropdown =
  (placeholder: string) =>
  ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FDP) => (
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

export const dateRangeFilterDropdown = ({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
}: FDP) => (
  <div className="p-3 w-70">
    <DatePicker.RangePicker
      className="w-full mb-2"
      value={selectedKeys[0] as unknown as [Dayjs | null, Dayjs | null]}
      onChange={(dates) => setSelectedKeys(dates ? [dates as unknown as Key] : [])}
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
        Apply
      </button>
    </div>
  </div>
)

export const dateFilterIcon = (filtered: boolean) => (
  <CalendarBlank
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    color={filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)'}
  />
)

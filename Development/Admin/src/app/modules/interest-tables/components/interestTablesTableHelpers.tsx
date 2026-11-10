import React from 'react'
import { Input, Button, DatePicker } from 'antd'
import {
  MagnifyingGlass,
  CalendarBlank,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  Funnel,
} from '@phosphor-icons/react'
import dayjs from 'dayjs'
import { parseFlexibleDate } from '../../../../shared/utils/dateHelpers'

export const tableSortIcon = ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
  if (sortOrder === 'ascend') return <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
  if (sortOrder === 'descend')
    return <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
  return <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
}

export const funnelIcon = (filtered: boolean) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

type FilterDropdownProps = {
  setSelectedKeys: (keys: React.Key[]) => void
  selectedKeys: React.Key[]
  confirm: () => void
  clearFilters?: () => void
}

const greyBtnStyle: React.CSSProperties = {
  borderColor: 'var(--color-border-strong)',
  color: 'var(--color-text-muted)',
  borderRadius: 12,
}

const accentBtnStyle: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  background: 'var(--color-accent)',
  color: 'white',
  border: 'none',
  borderRadius: 12,
  fontFamily: 'Poppins, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
}

export function makeSearchFilter(placeholder: string, dataIndex: string) {
  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: FilterDropdownProps) => (
      <div style={{ padding: 12, width: 240 }}>
        <Input
          autoFocus
          prefix={<MagnifyingGlass size={14} style={{ color: 'var(--color-text-subtle)' }} />}
          placeholder={placeholder}
          value={selectedKeys[0] as string}
          onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
          onPressEnter={() => confirm()}
          style={{ marginBottom: 8, borderRadius: 12 }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={() => {
              clearFilters?.()
              confirm()
            }}
            style={greyBtnStyle}
          >
            Reset
          </Button>
          <button
            onClick={() => confirm()}
            style={accentBtnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
          >
            Search
          </button>
        </div>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <MagnifyingGlass
        size={14}
        weight={filtered ? 'fill' : 'regular'}
        style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
      />
    ),
    onFilter: (value: unknown, record: unknown) =>
      String((record as Record<string, unknown>)[dataIndex] ?? '')
        .toLowerCase()
        .includes(String(value).toLowerCase()),
  }
}

/**
 * Server-side search column: identical dropdown UI to {@link makeSearchFilter}
 * but with NO client `onFilter`. The typed value is surfaced through the
 * table's `onChange` filters bag; the parent maps it to the API `q` param and
 * re-queries. Mirrors the Users / Roles & Access server-side pattern.
 */
export function makeServerSearchFilter(placeholder: string) {
  const filter = makeSearchFilter(placeholder, '__server__')
  return { filterDropdown: filter.filterDropdown, filterIcon: filter.filterIcon }
}

export function makeDateFilter(dataIndex: string) {
  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: FilterDropdownProps) => (
      <div style={{ padding: 12, width: 280 }}>
        <DatePicker.RangePicker
          style={{ width: '100%', marginBottom: 8 }}
          value={selectedKeys[0] as unknown as [dayjs.Dayjs, dayjs.Dayjs]}
          onChange={(dates) => setSelectedKeys(dates ? [dates as unknown as React.Key] : [])}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={() => {
              clearFilters?.()
              confirm()
            }}
            style={greyBtnStyle}
          >
            Reset
          </Button>
          <button
            onClick={() => confirm()}
            style={accentBtnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
          >
            Apply
          </button>
        </div>
      </div>
    ),
    filterIcon: (filtered: boolean) => (
      <CalendarBlank
        size={14}
        weight={filtered ? 'fill' : 'regular'}
        style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
      />
    ),
    onFilter: (value: unknown, record: unknown) => {
      const range = value as unknown as [dayjs.Dayjs, dayjs.Dayjs] | null
      if (!range || !Array.isArray(range) || range.length !== 2) return true
      const [start, end] = range
      if (!start || !end) return true
      // Values may be ISO or 'DD-MM-YYYY HH:mm' — a strict dayjs() parse would
      // make every real-API row fail the range test (MET-1309).
      const d = parseFlexibleDate((record as Record<string, unknown>)[dataIndex] as string)
      if (!d.isValid()) return false
      return d.isAfter(dayjs(start).subtract(1, 'day')) && d.isBefore(dayjs(end).add(1, 'day'))
    },
  }
}

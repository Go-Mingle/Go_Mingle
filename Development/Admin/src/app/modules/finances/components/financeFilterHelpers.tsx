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
import type { FinanceSearchField, FinanceSortField, ListFinancesQueryParams } from '../types'

// ── Server-driven column state helpers ──────────────────────────
// Derive the Antd-controlled `filteredValue`/`sortOrder` column props from
// the query params actually sent to the list API, so the header UI reflects
// server state instead of trying to filter/sort the (already single-page) data.
export function searchFilteredValue(
  queryParams: ListFinancesQueryParams,
  field: FinanceSearchField,
): string[] {
  // CR-62 / MET-753 — each column reads its own parameter, so several magnifiers
  // can show as active at once. Previously only the column matching the single
  // `searchField` lit up, even when the user had typed into two.
  const term = queryParams[field]
  return term ? [term] : []
}

export function dateRangeFilteredValue(
  queryParams: ListFinancesQueryParams,
): [dayjs.Dayjs, dayjs.Dayjs][] {
  if (!queryParams.dateFrom || !queryParams.dateTo) return []
  return [[dayjs(queryParams.dateFrom), dayjs(queryParams.dateTo)]]
}

export function columnSortOrder(
  queryParams: ListFinancesQueryParams,
  field: FinanceSortField,
): 'ascend' | 'descend' | null {
  if (queryParams.sortBy !== field) return null
  if (queryParams.sortOrder === 'asc') return 'ascend'
  if (queryParams.sortOrder === 'desc') return 'descend'
  return null
}

// ── Shared button styles ───────────────────────────────────────
export const coralBtnStyle: React.CSSProperties = {
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

export const greyBtnStyle: React.CSSProperties = {
  borderColor: 'var(--color-border-strong)',
  color: 'var(--color-text-muted)',
  borderRadius: 12,
}

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
          style={coralBtnStyle}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
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
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

// ── Date range filter dropdown ─────────────────────────────────
export const dateRangeFilterDropdown = ({
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
        style={coralBtnStyle}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
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
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

export const funnelIcon = (filtered: boolean) => (
  <Funnel
    size={14}
    weight={filtered ? 'fill' : 'regular'}
    style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
  />
)

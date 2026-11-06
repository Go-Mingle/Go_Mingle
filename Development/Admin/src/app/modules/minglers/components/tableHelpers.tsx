import React from 'react'
import { Input, Button, DatePicker } from 'antd'
import {
  MagnifyingGlass,
  CalendarBlank,
  ArrowUp,
  ArrowDown,
  ArrowsDownUp,
  Funnel,
} from '@phosphor-icons/react'
import dayjs from 'dayjs'

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
  transition: 'background 150ms ease-out',
}

export const greyBtnStyle: React.CSSProperties = {
  borderColor: 'var(--color-border-strong)',
  color: 'var(--color-text-muted)',
  background: 'var(--color-card)',
  borderRadius: 12,
  fontSize: 12,
}

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

// The minglers API filters/searches server-side, so this only surfaces the
// confirmed value via `onSearch` — it never filters rows locally (no
// `onFilter`). Pair with a controlled `filteredValue` on the column so the
// dropdown/icon reflect the current server query params.
// Phone search masking: keep only digits and a single leading "+".
// Any letters/symbols (typed or pasted) are stripped; a "+" is only honored
// when it's the first character.
export const sanitizePhoneInput = (raw: string): string => {
  const cleaned = raw.replace(/[^\d+]/g, '')
  const hasLeadingPlus = cleaned.startsWith('+')
  const digits = cleaned.replace(/\+/g, '')
  return (hasLeadingPlus ? '+' : '') + digits
}

export function makeSearchFilter(
  placeholder: string,
  onSearch: (value: string | undefined) => void,
  // Optional per-column input masking. When provided, every keystroke/paste is
  // run through `sanitize` before it reaches the field — e.g. the phone column
  // strips out anything that isn't a digit or a leading "+". Omit for plain
  // text columns (name, email) which stay unrestricted.
  sanitize?: (raw: string) => string,
  // Optional client-side length guard. When provided, a term whose trimmed
  // length exceeds `maxLength` shows `message` inline and is NOT submitted, so
  // the request the backend would reject with a 400 is never sent and the
  // listing behind the dropdown stays intact. Omit for columns with no server
  // length limit (e.g. the client-side `makeLocalSearchFilter`).
  validation?: { maxLength: number; message: string },
) {
  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: FilterDropdownProps) => {
      const term = (selectedKeys[0] as string) ?? ''
      const tooLong = !!validation && term.trim().length > validation.maxLength
      return (
        <div style={{ padding: 12, width: 240 }}>
          <Input
            autoFocus
            status={tooLong ? 'error' : undefined}
            inputMode={sanitize ? 'tel' : undefined}
            prefix={<MagnifyingGlass size={14} style={{ color: 'var(--color-text-subtle)' }} />}
            placeholder={placeholder}
            value={selectedKeys[0] as string}
            onKeyDown={(e) => {
              if (!sanitize) return
              // Let control keys (Backspace, arrows, Tab…) and shortcuts through.
              if (e.ctrlKey || e.metaKey || e.altKey || e.key.length > 1) return
              // Block any printable key that sanitization would strip — the char
              // is never captured by the field (e.g. letters in the phone filter).
              const current = e.currentTarget.value
              if (sanitize(current + e.key) === sanitize(current)) e.preventDefault()
            }}
            onChange={(e) => {
              const raw = e.target.value
              const next = sanitize ? sanitize(raw) : raw
              // Safety net for paste / drag / autofill (which bypass keydown):
              // write the sanitized value back so a rejected char can't linger.
              if (sanitize && next !== raw) e.target.value = next
              setSelectedKeys(next ? [next] : [])
            }}
            onPressEnter={() => {
              if (tooLong) return
              onSearch(selectedKeys[0] as string | undefined)
              confirm()
            }}
            style={{ marginBottom: tooLong ? 4 : 8, borderRadius: 12 }}
          />
          {tooLong && (
            <div className="mb-2 text-xs text-[var(--color-error)]">{validation.message}</div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button
              size="small"
              onClick={() => {
                clearFilters?.()
                onSearch(undefined)
                confirm()
              }}
              style={greyBtnStyle}
            >
              Reset
            </Button>
            <button
              onClick={() => {
                if (tooLong) return
                onSearch(selectedKeys[0] as string | undefined)
                confirm()
              }}
              style={coralBtnStyle}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-accent-dark)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-accent)')}
            >
              Search
            </button>
          </div>
        </div>
      )
    },
    filterIcon: (filtered: boolean) => (
      <MagnifyingGlass
        size={14}
        weight={filtered ? 'fill' : 'regular'}
        style={{ color: filtered ? 'var(--color-accent)' : 'var(--color-text-subtle)' }}
      />
    ),
  }
}

// For columns that filter a fully client-side dataset (e.g. reviews), where
// there's no server query to drive — pairs `onFilter` with `dataIndex`
// instead of a callback.
export function makeLocalSearchFilter(placeholder: string, dataIndex: string) {
  return {
    ...makeSearchFilter(placeholder, () => {}),
    onFilter: (value: unknown, record: Record<string, unknown>) =>
      String(record[dataIndex] ?? '')
        .toLowerCase()
        .includes(String(value).toLowerCase()),
  }
}

type DateFilterDropdownProps = {
  setSelectedKeys: (keys: React.Key[]) => void
  selectedKeys: React.Key[]
  confirm: () => void
  clearFilters?: () => void
}

// The minglers API filters the joined-date range server-side via
// joinedFrom/joinedTo, so this only surfaces the confirmed range via
// `onRangeChange` — no local `onFilter`. Pair with a controlled
// `filteredValue` on the column.
// A mingler's join date can never be in the future, so the joined-date range
// filter blocks any day after today.
export const isFutureDate = (current: dayjs.Dayjs) => !!current && current > dayjs().endOf('day')

export function makeDateFilter(
  onRangeChange: (from: string | undefined, to: string | undefined) => void,
) {
  return {
    filterDropdown: ({
      setSelectedKeys,
      selectedKeys,
      confirm,
      clearFilters,
    }: DateFilterDropdownProps) => (
      <div style={{ padding: 12, width: 280 }}>
        <DatePicker.RangePicker
          style={{ width: '100%', marginBottom: 8 }}
          disabledDate={isFutureDate}
          value={selectedKeys[0] as unknown as [dayjs.Dayjs, dayjs.Dayjs]}
          onChange={(dates) => setSelectedKeys(dates ? [dates as unknown as React.Key] : [])}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button
            size="small"
            onClick={() => {
              clearFilters?.()
              onRangeChange(undefined, undefined)
              confirm()
            }}
            style={greyBtnStyle}
          >
            Reset
          </Button>
          <button
            onClick={() => {
              const range = selectedKeys[0] as unknown as [dayjs.Dayjs, dayjs.Dayjs] | undefined
              onRangeChange(range?.[0]?.format('YYYY-MM-DD'), range?.[1]?.format('YYYY-MM-DD'))
              confirm()
            }}
            style={coralBtnStyle}
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
  }
}

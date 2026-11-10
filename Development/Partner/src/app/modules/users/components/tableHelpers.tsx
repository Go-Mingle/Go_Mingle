import type { Key, ReactNode } from 'react'
import type { Dayjs } from 'dayjs'
import { Input, Button, DatePicker } from 'antd'
import {
  MagnifyingGlass,
  CalendarBlank,
  ArrowsDownUp,
  ArrowUp,
  ArrowDown,
  Funnel,
} from '@phosphor-icons/react'

export const userStatusColours: Record<string, { bg: string }> = {
  active: { bg: 'var(--color-success)' },
  suspended: { bg: 'var(--color-error)' },
}

/** Small caps label inside a filter dropdown. */
export const FILTER_LABEL_CLASS =
  'mb-2 block font-[Poppins,sans-serif] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

/**
 * Every column affordance below is wrapped in a *named* span.
 *
 * antd renders a custom `sortIcon` / `filterIcon` bare — it does not add its own
 * `ant-table-column-sorter` wrapper — so returning a naked Phosphor <svg> leaves
 * the column carrying a control with no class, no role and no accessible name.
 * The search, status and date-range controls on this grid were all built and all
 * worked; nothing in the DOM identified them, which is why MET-1247 was filed as
 * "the controls were never built" (MET-1525 was the same trap on Contacts).
 *
 * The affordance is the label, not just the pixels: wrap it, name it per column,
 * and give it a `title` so a pointer user gets the same hint.
 */
function namedAffordance(className: string, label: string, icon: ReactNode) {
  return (
    <span className={className} role="img" aria-label={label} title={label}>
      {icon}
    </span>
  )
}

export const tableSortIcon =
  (label: string) =>
  ({ sortOrder }: { sortOrder: 'ascend' | 'descend' | null }) => {
    let icon = <ArrowsDownUp size={12} color="var(--color-text-subtle)" />
    if (sortOrder === 'ascend') {
      icon = <ArrowUp size={12} weight="bold" color="var(--color-accent)" />
    } else if (sortOrder === 'descend') {
      icon = <ArrowDown size={12} weight="bold" color="var(--color-accent)" />
    }
    return namedAffordance('ant-table-column-sorter', label, icon)
  }

export const searchFilterIcon = (label: string) => (filtered: boolean) =>
  namedAffordance(
    'ant-table-column-search inline-flex',
    label,
    <MagnifyingGlass
      size={14}
      weight={filtered ? 'fill' : 'regular'}
      className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
    />,
  )

export const dateFilterIcon = (label: string) => (filtered: boolean) =>
  namedAffordance(
    'ant-table-column-date-filter inline-flex',
    label,
    <CalendarBlank
      size={14}
      weight={filtered ? 'fill' : 'regular'}
      className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
    />,
  )

export const statusFilterIcon = (label: string) => (filtered: boolean) =>
  namedAffordance(
    'ant-table-column-status-filter inline-flex',
    label,
    <Funnel
      size={14}
      weight={filtered ? 'fill' : 'regular'}
      className={filtered ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-subtle)]'}
    />,
  )

interface FDP {
  setSelectedKeys: (keys: Key[]) => void
  selectedKeys: Key[]
  confirm: () => void
  clearFilters?: () => void
}

/** Reset / submit copy comes from the caller so nothing here ships untranslated. */
interface DropdownButtonLabels {
  reset: string
  submit: string
}

/**
 * Plain factory rather than a component: this module exports helpers, not
 * components, and mixing the two trips `react-refresh/only-export-components`.
 */
function dropdownFooter({
  reset,
  submit,
  confirm,
  clearFilters,
}: DropdownButtonLabels & Pick<FDP, 'confirm' | 'clearFilters'>) {
  return (
    <div className="flex gap-2 justify-end">
      <Button
        size="small"
        onClick={() => {
          clearFilters?.()
          confirm()
        }}
        className="border-[var(--color-border-strong)] text-[var(--color-text-muted)] rounded-lg"
      >
        {reset}
      </Button>
      <button
        type="button"
        onClick={() => confirm()}
        className="h-7 px-3 bg-[var(--color-accent)] text-white border-none rounded-lg font-[Poppins,sans-serif] text-xs font-semibold cursor-pointer hover:bg-[var(--color-accent-dark)]"
      >
        {submit}
      </button>
    </div>
  )
}

export interface SearchDropdownLabels extends DropdownButtonLabels {
  /** In-field hint, e.g. "Search name…". */
  placeholder: string
  /** Accessible name for the field, e.g. "Search by NAME". */
  fieldLabel: string
}

export const searchFilterDropdown =
  ({ placeholder, fieldLabel, reset, submit }: SearchDropdownLabels) =>
  ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FDP) => (
    <div className="p-3 w-60">
      <Input
        autoFocus
        aria-label={fieldLabel}
        prefix={<MagnifyingGlass size={14} className="text-[var(--color-text-subtle)]" />}
        placeholder={placeholder}
        value={selectedKeys[0] as string}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        className="mb-2 rounded-xl"
      />
      {dropdownFooter({ reset, submit, confirm, clearFilters })}
    </div>
  )

export interface DateRangeDropdownLabels extends DropdownButtonLabels {
  /** Visible heading above the picker, e.g. "Filter by LAST ACTIVE". */
  fieldLabel: string
  /** Placeholders for the two ends of the range. */
  fromPlaceholder: string
  toPlaceholder: string
}

export const dateRangeFilterDropdown =
  ({ fieldLabel, fromPlaceholder, toPlaceholder, reset, submit }: DateRangeDropdownLabels) =>
  ({ setSelectedKeys, selectedKeys, confirm, clearFilters }: FDP) => (
    <div className="p-3 w-[280px]">
      {/* Named in the open dropdown too — the calendar glyph alone left QA
          unable to tell a date filter from a decoration. */}
      <span className={FILTER_LABEL_CLASS}>{fieldLabel}</span>
      <DatePicker.RangePicker
        className="w-full mb-2"
        placeholder={[fromPlaceholder, toPlaceholder]}
        value={selectedKeys[0] as unknown as [Dayjs | null, Dayjs | null]}
        onChange={(dates) => setSelectedKeys(dates ? [dates as unknown as Key] : [])}
      />
      {dropdownFooter({ reset, submit, confirm, clearFilters })}
    </div>
  )

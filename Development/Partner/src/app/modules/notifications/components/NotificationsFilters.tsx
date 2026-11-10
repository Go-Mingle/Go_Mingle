import { Input, DatePicker, Select, Checkbox, Modal, Grid } from 'antd'
import {
  MagnifyingGlass,
  CaretDown,
  Checks,
  ArrowDown,
  ArrowUp,
  Funnel,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type dayjs from 'dayjs'
import { NOTIFICATION_WINDOW_DAYS } from '../constants'
import { isDateOutsideWindow } from '../format'
import type { NotificationStatus, NotificationTypeOption } from '../types'

const { RangePicker } = DatePicker

export type SortOrder = 'desc' | 'asc'
export type DateRangeValue = [dayjs.Dayjs | null, dayjs.Dayjs | null] | null

interface FilterOption<V extends string> {
  value: V
  label: string
}

// 40px control bar (h-10) — search, filters and action buttons all share one height.
const NEUTRAL_BTN =
  'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[12px] border-[1.5px] ' +
  'bg-[var(--color-card)] border-[var(--color-border-strong)] text-[var(--color-text-secondary)] ' +
  "font-['Poppins',sans-serif] text-[13px] font-medium cursor-pointer transition-colors " +
  'md:hover:border-[var(--color-text-muted)] md:hover:text-[var(--color-text)] whitespace-nowrap'

const ACCENT_BTN =
  'inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-[12px] border-[1.5px] ' +
  'bg-[var(--color-accent-light)] border-[var(--color-accent)] text-[var(--color-accent-dark)] ' +
  "font-['Poppins',sans-serif] text-[13px] font-medium cursor-pointer transition-colors " +
  'md:hover:bg-[var(--color-accent)] md:hover:text-white whitespace-nowrap'

const MODAL_LABEL =
  'block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] mb-1.5'

interface NotificationsFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  /** Catalogue keys, from the /types endpoint rather than a hardcoded list (BR-02). */
  typeFilters: string[]
  onTypeFiltersChange: (values: string[]) => void
  /** The options themselves, so an unknown type is never offered as a filter. */
  typeOptions: NotificationTypeOption[]
  /** A single value on the wire — ALL is the absence of a filter, not a third choice. */
  status: NotificationStatus
  onStatusChange: (value: NotificationStatus) => void
  dateRange: DateRangeValue
  onDateRangeChange: (value: DateRangeValue) => void
  sortOrder: SortOrder
  onSortOrderToggle: () => void
  unreadCount: number
  onMarkAllRead: () => void
  markingAll?: boolean
  onClearFilters: () => void
  hasFilters: boolean
}

function renderCheckboxOption<V extends string>(option: FilterOption<V>, selected: V[]) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox checked={selected.includes(option.value)} />
      <span>{option.label}</span>
    </div>
  )
}

interface SearchInputProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  className: string
}

function SearchInput({ searchTerm, onSearchChange, className }: SearchInputProps) {
  const { t } = useTranslation('notifications')
  return (
    <Input
      allowClear
      size="large"
      value={searchTerm}
      onChange={(e) => onSearchChange(e.target.value)}
      placeholder={t('searchPlaceholder')}
      prefix={<MagnifyingGlass size={14} className="text-[var(--color-text-subtle)]" />}
      className={className}
    />
  )
}

interface TypeSelectProps {
  typeFilters: string[]
  onTypeFiltersChange: (values: string[]) => void
  typeOptions: NotificationTypeOption[]
  className: string
}

/**
 * The Type filter.
 *
 * Options come from the catalogue endpoint, so a type the backend has added but this
 * client does not recognise is never offered here — it still renders on a row, it just
 * cannot be filtered on, which is exactly BR-02.
 */
function TypeSelect({ typeFilters, onTypeFiltersChange, typeOptions, className }: TypeSelectProps) {
  const { t } = useTranslation('notifications')
  const options: FilterOption<string>[] = typeOptions.map((option) => ({
    value: option.type,
    label: option.label,
  }))
  return (
    <Select<string[]>
      mode="multiple"
      size="large"
      allowClear
      showSearch={false}
      maxTagCount="responsive"
      value={typeFilters}
      onChange={onTypeFiltersChange}
      placeholder={t('filters.typeLabel')}
      options={options}
      optionRender={(opt) =>
        renderCheckboxOption({ value: String(opt.value), label: String(opt.label) }, typeFilters)
      }
      menuItemSelectedIcon={null}
      suffixIcon={<CaretDown size={12} weight="bold" />}
      className={className}
    />
  )
}

interface StatusSelectProps {
  status: NotificationStatus
  onStatusChange: (value: NotificationStatus) => void
  className: string
}

/**
 * The Status filter.
 *
 * Single-select, unlike the prototype's checkbox pair. The wire takes one value, and the
 * prototype's "both ticked means no filter" rule was an artefact of filtering in memory —
 * `ALL` says the same thing without the ambiguity.
 */
function StatusSelect({ status, onStatusChange, className }: StatusSelectProps) {
  const { t } = useTranslation('notifications')
  const statusOptions: FilterOption<NotificationStatus>[] = [
    { value: 'ALL', label: t('filters.statusAll') },
    { value: 'UNREAD', label: t('filters.unread') },
    { value: 'READ', label: t('filters.read') },
  ]
  return (
    <Select<NotificationStatus>
      size="large"
      showSearch={false}
      value={status}
      onChange={onStatusChange}
      placeholder={t('filters.statusLabel')}
      options={statusOptions}
      suffixIcon={<CaretDown size={12} weight="bold" />}
      className={className}
    />
  )
}

interface RangePickerControlProps {
  dateRange: DateRangeValue
  onDateRangeChange: (value: DateRangeValue) => void
  className: string
}

/**
 * The date range.
 *
 * Two constraints come straight from the API's two 400s, and both are enforced here so
 * neither is reachable:
 *
 *  - **A future end date is refused** (`ERR_DATE_RANGE_INVALID`), so tomorrow onwards is
 *    unselectable rather than selectable-then-rejected.
 *  - **Both dates or neither** (`ERR_DATE_RANGE_INCOMPLETE`), which the caller enforces by
 *    only applying a complete pair — AntD's RangePicker already emits both together.
 *
 * The 90-day window is invisible in the API: an older start date is silently clamped, so a
 * range from last year returns nothing and looks broken. The hint says why, and dates
 * before the cutoff are disabled so the question does not arise.
 */
function RangePickerControl({ dateRange, onDateRangeChange, className }: RangePickerControlProps) {
  const { t } = useTranslation('notifications')

  return (
    <RangePicker
      size="large"
      value={dateRange}
      onChange={(v) => onDateRangeChange(v as DateRangeValue)}
      disabledDate={(current) => isDateOutsideWindow(current.toDate(), NOTIFICATION_WINDOW_DAYS)}
      placeholder={[t('filters.dateLabel'), t('filters.dateHint')]}
      allowClear
      className={className}
    />
  )
}

interface SortButtonProps {
  sortOrder: SortOrder
  onSortOrderToggle: () => void
  className: string
}

function SortButton({ sortOrder, onSortOrderToggle, className }: SortButtonProps) {
  const { t } = useTranslation('notifications')
  return (
    <button type="button" onClick={onSortOrderToggle} className={className}>
      {sortOrder === 'desc' ? <ArrowDown size={15} /> : <ArrowUp size={15} />}
      <span>{sortOrder === 'desc' ? t('sortNewest') : t('sortOldest')}</span>
    </button>
  )
}

interface MarkAllButtonProps {
  unreadCount: number
  onMarkAllRead: () => void
  markingAll?: boolean
  className: string
}

/** Absent, not disabled, when nothing is unread (BR-09). */
function MarkAllButton({ unreadCount, onMarkAllRead, markingAll, className }: MarkAllButtonProps) {
  const { t } = useTranslation('notifications')
  return unreadCount > 0 ? (
    <button type="button" onClick={onMarkAllRead} disabled={markingAll} className={className}>
      <Checks size={15} />
      <span>{t('markAllRead')}</span>
    </button>
  ) : null
}

// ── Desktop: single inline control bar ─────────────────────────
function DesktopFilterBar({
  searchTerm,
  onSearchChange,
  typeFilters,
  onTypeFiltersChange,
  typeOptions,
  status,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  sortOrder,
  onSortOrderToggle,
  unreadCount,
  onMarkAllRead,
  markingAll,
  onClearFilters,
  hasFilters,
}: NotificationsFiltersProps) {
  const { t } = useTranslation('notifications')
  return (
    // The row wraps rather than compresses. Eight controls do not fit on one line at 1280 —
    // the most common laptop width — and without a floor the search box is the one that
    // gives, ending up 0px wide with only its magnifier showing (MET-1263).
    <div className="mb-6 flex flex-row flex-wrap items-center gap-3">
      <SearchInput
        searchTerm={searchTerm}
        onSearchChange={onSearchChange}
        className="min-w-[200px] flex-1"
      />
      <TypeSelect
        typeFilters={typeFilters}
        onTypeFiltersChange={onTypeFiltersChange}
        typeOptions={typeOptions}
        className="w-[190px]"
      />
      <StatusSelect status={status} onStatusChange={onStatusChange} className="w-[170px]" />
      <RangePickerControl
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        className="w-[240px]"
      />
      <SortButton
        sortOrder={sortOrder}
        onSortOrderToggle={onSortOrderToggle}
        className={`${NEUTRAL_BTN} w-auto`}
      />
      {/* Only offered when there is something to clear. */}
      {hasFilters && (
        <button type="button" onClick={onClearFilters} className={`${NEUTRAL_BTN} w-auto`}>
          {t('filters.clearFilters')}
        </button>
      )}
      <MarkAllButton
        unreadCount={unreadCount}
        onMarkAllRead={onMarkAllRead}
        markingAll={markingAll}
        className={`${ACCENT_BTN} w-auto`}
      />
    </div>
  )
}

interface MobileFilterModalProps {
  filterOpen: boolean
  setFilterOpen: (open: boolean) => void
  typeFilters: string[]
  onTypeFiltersChange: (values: string[]) => void
  typeOptions: NotificationTypeOption[]
  status: NotificationStatus
  onStatusChange: (value: NotificationStatus) => void
  dateRange: DateRangeValue
  onDateRangeChange: (value: DateRangeValue) => void
  onClearFilters: () => void
}

function MobileFilterModal({
  filterOpen,
  setFilterOpen,
  typeFilters,
  onTypeFiltersChange,
  typeOptions,
  status,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  onClearFilters,
}: MobileFilterModalProps) {
  const { t } = useTranslation('notifications')
  return (
    <Modal
      open={filterOpen}
      onCancel={() => setFilterOpen(false)}
      title={t('filters.title')}
      footer={null}
      width={420}
      destroyOnHidden
    >
      <div className="flex flex-col gap-4 pt-1">
        <div>
          <label className={MODAL_LABEL}>{t('filters.typeLabel')}</label>
          <TypeSelect
            typeFilters={typeFilters}
            onTypeFiltersChange={onTypeFiltersChange}
            typeOptions={typeOptions}
            className="w-full"
          />
        </div>
        <div>
          <label className={MODAL_LABEL}>{t('filters.statusLabel')}</label>
          <StatusSelect status={status} onStatusChange={onStatusChange} className="w-full" />
        </div>
        <div>
          <label className={MODAL_LABEL}>{t('filters.dateLabel')}</label>
          <RangePickerControl
            dateRange={dateRange}
            onDateRangeChange={onDateRangeChange}
            className="w-full"
          />
        </div>
        <div className="flex justify-end gap-2 pt-4 -mx-6 px-6 border-t border-[var(--color-border)]">
          <button type="button" onClick={onClearFilters} className={NEUTRAL_BTN}>
            {t('filters.clearAll')}
          </button>
          <button type="button" onClick={() => setFilterOpen(false)} className={ACCENT_BTN}>
            {t('filters.apply')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

interface MobileFiltersProps extends NotificationsFiltersProps {
  filterOpen: boolean
  setFilterOpen: (open: boolean) => void
  activeFilterCount: number
}

// ── Mobile: search + filter icon; sort + mark-all on a hugging row ──
function MobileFilters({
  searchTerm,
  onSearchChange,
  typeFilters,
  onTypeFiltersChange,
  typeOptions,
  status,
  onStatusChange,
  dateRange,
  onDateRangeChange,
  sortOrder,
  onSortOrderToggle,
  unreadCount,
  onMarkAllRead,
  markingAll,
  onClearFilters,
  filterOpen,
  setFilterOpen,
  activeFilterCount,
}: MobileFiltersProps) {
  const { t } = useTranslation('notifications')
  return (
    <div className="flex flex-col gap-3 mb-6">
      <div className="flex items-center gap-2">
        <SearchInput searchTerm={searchTerm} onSearchChange={onSearchChange} className="flex-1" />
        <button
          type="button"
          onClick={() => setFilterOpen(true)}
          aria-label={t('filters.title')}
          className={`${NEUTRAL_BTN} w-10 !px-0 relative shrink-0`}
        >
          <Funnel size={16} weight={activeFilterCount > 0 ? 'fill' : 'regular'} />
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center rounded-full bg-[var(--color-coral)] text-white text-[10px] font-bold leading-none">
              {activeFilterCount}
            </span>
          )}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <SortButton
          sortOrder={sortOrder}
          onSortOrderToggle={onSortOrderToggle}
          className={NEUTRAL_BTN}
        />
        <MarkAllButton
          unreadCount={unreadCount}
          onMarkAllRead={onMarkAllRead}
          markingAll={markingAll}
          className={ACCENT_BTN}
        />
      </div>

      <MobileFilterModal
        filterOpen={filterOpen}
        setFilterOpen={setFilterOpen}
        typeFilters={typeFilters}
        onTypeFiltersChange={onTypeFiltersChange}
        typeOptions={typeOptions}
        status={status}
        onStatusChange={onStatusChange}
        dateRange={dateRange}
        onDateRangeChange={onDateRangeChange}
        onClearFilters={onClearFilters}
      />
    </div>
  )
}

export function NotificationsFilters(props: NotificationsFiltersProps) {
  const { typeFilters, status, dateRange } = props
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md
  const [filterOpen, setFilterOpen] = useState(false)

  // Count of active filter groups — shown as a badge on the mobile filter button.
  // `ALL` is not a filter, so it does not count.
  const activeFilterCount =
    typeFilters.length + (status !== 'ALL' ? 1 : 0) + (dateRange?.[0] && dateRange?.[1] ? 1 : 0)

  if (!isMobile) {
    return <DesktopFilterBar {...props} />
  }

  return (
    <MobileFilters
      {...props}
      filterOpen={filterOpen}
      setFilterOpen={setFilterOpen}
      activeFilterCount={activeFilterCount}
    />
  )
}

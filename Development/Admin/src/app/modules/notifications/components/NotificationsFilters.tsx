import { Input, DatePicker, Select } from 'antd'
import { MagnifyingGlass, CaretDown } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { Dayjs } from 'dayjs'
import type { NotificationStatusFilter, NotificationTypeOption } from '../types'
import { NOTIFICATIONS_SEARCH_MAX_LENGTH } from '../constants'
import { isFutureDate } from '../../../../shared/utils/dateHelpers'

const { RangePicker } = DatePicker

export type StatusFilter = NotificationStatusFilter
export type DateRangeValue = [Dayjs | null, Dayjs | null] | null

interface NotificationsFiltersProps {
  searchTerm: string
  onSearchChange: (value: string) => void
  typeFilter: string | undefined
  typeOptions: NotificationTypeOption[]
  onTypeFilterChange: (value: string | undefined) => void
  statusFilter: StatusFilter
  onStatusFilterChange: (value: StatusFilter) => void
  dateRange: DateRangeValue
  onDateRangeChange: (value: DateRangeValue) => void
}

export function NotificationsFilters({
  searchTerm,
  onSearchChange,
  typeFilter,
  typeOptions,
  onTypeFilterChange,
  statusFilter,
  onStatusFilterChange,
  dateRange,
  onDateRangeChange,
}: NotificationsFiltersProps) {
  const { t } = useTranslation('notifications')

  const statusOptions: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: t('filters.all') },
    { value: 'unread', label: t('filters.unread') },
    { value: 'read', label: t('filters.read') },
  ]

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-3 mb-5">
      <Input
        allowClear
        value={searchTerm}
        maxLength={NOTIFICATIONS_SEARCH_MAX_LENGTH}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        prefix={<MagnifyingGlass size={14} className="text-[var(--color-text-subtle)]" />}
        className="flex-1 w-full md:w-auto"
      />

      <Select<string>
        allowClear
        showSearch={false}
        value={typeFilter}
        onChange={(v) => onTypeFilterChange(v)}
        placeholder={t('filters.typeLabel')}
        options={typeOptions.map((o) => ({ value: o.key, label: o.label }))}
        suffixIcon={<CaretDown size={12} weight="bold" />}
        className="w-full md:w-[200px]"
      />

      <Select<StatusFilter>
        value={statusFilter}
        onChange={onStatusFilterChange}
        placeholder={t('filters.statusLabel')}
        options={statusOptions}
        suffixIcon={<CaretDown size={12} weight="bold" />}
        className="w-full md:w-[160px]"
      />

      <RangePicker
        value={dateRange}
        onChange={(v) => onDateRangeChange(v as DateRangeValue)}
        allowClear
        // Notifications can't be created in the future — block future dates.
        disabledDate={(current) => isFutureDate(current)}
        className="w-full md:w-[260px]"
      />
    </div>
  )
}

import { Select } from 'antd'
import { useTranslation } from 'react-i18next'
import type { FinancePeriod } from '../types'
import { PERIOD_TABS } from '../constants'

const PERIOD_KEY_TO_I18N: Record<string, string> = {
  today: 'today',
  this_week: 'thisWeek',
  this_month: 'thisMonth',
  last_6_months: 'last6Months',
  last_1_year: 'lastYear',
  all_time: 'allTime',
}

interface FinancePeriodDropdownProps {
  value: FinancePeriod
  onChange: (period: FinancePeriod) => void
}

export function FinancePeriodDropdown({ value, onChange }: FinancePeriodDropdownProps) {
  const { t } = useTranslation('finances')

  const options = PERIOD_TABS.map(({ key }) => ({
    value: key,
    label: t(`periods.${PERIOD_KEY_TO_I18N[key] ?? key}`),
  }))

  return (
    <Select<FinancePeriod>
      value={value}
      onChange={onChange}
      options={options}
      className="w-40 shrink-0"
      popupMatchSelectWidth={false}
    />
  )
}

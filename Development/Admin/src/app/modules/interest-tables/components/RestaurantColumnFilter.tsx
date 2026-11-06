import { useState } from 'react'
import { Checkbox, Input } from 'antd'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { AppButton } from '../../../atoms/AppButton'
import { decodeRestaurantFilter, encodeRestaurantFilter } from '../masterListHelpers'

export interface RestaurantFilterOption {
  label: string
  value: string
}

interface Props {
  options: RestaurantFilterOption[]
  selectedKeys: React.Key[]
  setSelectedKeys: (keys: React.Key[]) => void
  confirm: () => void
  clearFilters?: () => void
}

/** The API caps `search` at 100 characters and 400s beyond it. */
const SEARCH_MAX_LENGTH = 100

/**
 * The Restaurant column is both searchable (`search` + `searchField=restaurant`)
 * and multi-select filterable (`restaurantId[]`). AntD cannot express both with
 * its built-in `filterDropdown` and `filters` on one column, so this single
 * dropdown carries a name search box plus a checkbox list, and packs both into
 * AntD's flat `selectedKeys` array via encode/decodeRestaurantFilter.
 *
 * Local draft state is seeded from `selectedKeys` at mount; the caller keys this
 * component on the active filter so an external reset remounts it with fresh state.
 */
export function RestaurantColumnFilter({
  options,
  selectedKeys,
  setSelectedKeys,
  confirm,
  clearFilters,
}: Props) {
  const { t } = useTranslation(['interest-tables', 'common'])
  const decoded = decodeRestaurantFilter(selectedKeys)
  const [search, setSearch] = useState(decoded.search)
  const [checked, setChecked] = useState<string[]>(decoded.restaurantIds)

  const apply = () => {
    setSelectedKeys(encodeRestaurantFilter(search.trim(), checked))
    confirm()
  }

  const reset = () => {
    setSearch('')
    setChecked([])
    clearFilters?.()
    confirm()
  }

  return (
    <div className="w-[260px] p-3 font-[Poppins]">
      <Input
        autoFocus
        allowClear
        maxLength={SEARCH_MAX_LENGTH}
        prefix={<MagnifyingGlass size={14} className="text-[var(--color-text-subtle)]" />}
        placeholder={t('table.search.restaurant')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onPressEnter={apply}
        className="mb-3 rounded-xl"
      />

      {options.length > 0 && (
        <div className="mb-3 max-h-[180px] overflow-y-auto border-t border-[var(--color-divider)] pt-2">
          <Checkbox.Group
            value={checked}
            onChange={(next) => setChecked(next as string[])}
            className="flex flex-col gap-1.5"
            options={options}
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <AppButton variant="neutral" onClick={reset}>
          {t('common:buttons.reset')}
        </AppButton>
        <AppButton variant="primary" onClick={apply}>
          {t('common:buttons.apply')}
        </AppButton>
      </div>
    </div>
  )
}

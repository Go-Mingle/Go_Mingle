import { Input, Button } from 'antd'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { FilterDropdownProps } from 'antd/es/table/interface'

interface TableColumnSearchFilterProps extends FilterDropdownProps {
  placeholder: string
}

/**
 * Reusable column-header search dropdown for AntD tables. Wire it to a column's
 * `filterDropdown` and read the confirmed value from the table's `onChange`
 * handler (`filters[columnKey]?.[0]`) to drive a server-side `q` param.
 */
export function TableColumnSearchFilter({
  setSelectedKeys,
  selectedKeys,
  confirm,
  clearFilters,
  placeholder,
}: TableColumnSearchFilterProps) {
  const { t } = useTranslation()

  return (
    <div className="w-60 p-3">
      <Input
        autoFocus
        prefix={<MagnifyingGlass size={14} color="var(--color-text-subtle)" />}
        placeholder={placeholder}
        value={selectedKeys[0] as string}
        onChange={(e) => setSelectedKeys(e.target.value ? [e.target.value] : [])}
        onPressEnter={() => confirm()}
        className="mb-2 rounded-xl"
      />
      <div className="flex justify-end gap-2">
        <Button
          size="small"
          onClick={() => {
            clearFilters?.()
            confirm()
          }}
          className="rounded-xl text-xs"
        >
          {t('buttons.reset')}
        </Button>
        <Button
          size="small"
          type="primary"
          onClick={() => confirm()}
          className="rounded-xl text-xs"
        >
          {t('buttons.search')}
        </Button>
      </div>
    </div>
  )
}

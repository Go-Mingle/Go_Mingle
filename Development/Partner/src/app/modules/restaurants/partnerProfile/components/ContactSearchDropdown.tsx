import { useState } from 'react'
import { Button, Input } from 'antd'
import type { FilterDropdownProps } from 'antd/es/table/interface'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { ContactSortBy } from '../types'

interface ContactSearchDropdownProps extends FilterDropdownProps {
  field: ContactSortBy
  placeholder: string
  activeField: ContactSortBy | undefined
  activeTerm: string
  onApply: (field: ContactSortBy | undefined, term: string) => void
}

/**
 * Per-column search dropdown (AC-05.1).
 *
 * The endpoint takes a single `searchField` + `search` pair rather than four
 * independent filters, so searching one column replaces whatever was searched
 * before. Each dropdown therefore seeds itself from the live term only when its
 * own column owns it — antd's per-column `selectedKeys` would drift out of step
 * with the one term the server actually holds, and Name would end up echoing
 * Title's search.
 *
 * Seeding happens at mount rather than in an effect: the caller keys this on
 * `visible`, so every open is a fresh mount reading the current term.
 */
export function ContactSearchDropdown({
  field,
  placeholder,
  activeField,
  activeTerm,
  confirm,
  onApply,
}: ContactSearchDropdownProps) {
  const { t } = useTranslation(['restaurants', 'common'])
  const [value, setValue] = useState(activeField === field ? activeTerm : '')

  // A term without a field is a no-op server-side, so a blank one clears both.
  const apply = () => {
    onApply(value.trim() ? field : undefined, value)
    confirm({ closeDropdown: true })
  }

  const reset = () => {
    setValue('')
    onApply(undefined, '')
    confirm({ closeDropdown: true })
  }

  return (
    <div className="w-60 p-3">
      <Input
        autoFocus
        prefix={<MagnifyingGlass size={14} className="text-[var(--color-text-subtle)]" />}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onPressEnter={apply}
        className="mb-2 rounded-lg"
      />
      <div className="flex justify-end gap-2">
        <Button
          size="small"
          onClick={reset}
          className="rounded-lg border-[var(--color-border-strong)] text-[var(--color-text-muted)]"
        >
          {t('common:buttons.reset')}
        </Button>
        <button
          type="button"
          onClick={apply}
          className="h-7 cursor-pointer rounded-lg border-none bg-[var(--color-accent)] px-3 font-[Poppins,sans-serif] text-xs font-semibold text-white hover:bg-[var(--color-accent-dark)]"
        >
          {t('common:buttons.search')}
        </button>
      </div>
    </div>
  )
}

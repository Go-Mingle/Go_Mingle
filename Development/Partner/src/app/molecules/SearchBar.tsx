import { Input } from 'antd'
import { MagnifyingGlass as Search } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { clsx } from 'clsx'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
  total?: number
  placeholder?: string
  className?: string
  /**
   * Fired on Enter, for a **server-side** search.
   *
   * Callers that filter a list already in memory just use `onChange` and re-filter per
   * keystroke. When each change is a request, that would be a request per keystroke —
   * and this repo has no debounce hook — so those callers hold the draft locally and
   * commit here instead. Clearing the field still goes through `onChange`, which the
   * caller treats as an immediate commit.
   */
  onPressEnter?: (v: string) => void
}

export function SearchBar({
  value,
  onChange,
  total,
  placeholder,
  className,
  onPressEnter,
}: SearchBarProps) {
  const { t } = useTranslation('common')
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPressEnter={onPressEnter ? (e) => onPressEnter(e.currentTarget.value) : undefined}
        placeholder={placeholder ?? t('labels.search')}
        prefix={<Search size={16} className="text-[var(--color-text-subtle)]" />}
        className="h-[42px] rounded-[6px] flex-1"
        allowClear
      />
      {total != null && (
        <span className="text-[12px] text-[var(--color-text-subtle)] whitespace-nowrap shrink-0">
          {t('labels.records', { count: total })}
        </span>
      )}
    </div>
  )
}

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
}

export function SearchBar({ value, onChange, total, placeholder, className }: SearchBarProps) {
  const { t } = useTranslation('common')
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
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

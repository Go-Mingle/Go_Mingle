import { useMemo, useState } from 'react'
import { Input } from 'antd'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { ICON_CATEGORIES, searchLibraryIcons, type IconCategory } from '../iconLibrary'

interface IconLibraryPickerProps {
  value: string | null
  onChange: (name: string) => void
}

/** Searchable grid of library icons, filtered by category. */
export function IconLibraryPicker({ value, onChange }: IconLibraryPickerProps) {
  const { t } = useTranslation('amenities')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<IconCategory | 'all'>('all')
  const icons = useMemo(() => searchLibraryIcons(query, category), [query, category])

  return (
    <div className="flex flex-col gap-3">
      <Input
        allowClear
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        prefix={<MagnifyingGlass size={16} aria-hidden />}
        placeholder={t('library.searchPlaceholder')}
        aria-label={t('library.searchLabel')}
        className="h-10 rounded-lg"
      />
      <div
        role="group"
        aria-label={t('library.categoriesLabel')}
        className="flex flex-wrap gap-1.5"
      >
        {(['all', ...ICON_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
            className={`h-8 px-3 rounded-full border text-xs font-medium cursor-pointer transition-colors duration-150 ${
              category === c
                ? 'bg-(--color-text) text-(--color-card) border-(--color-text)'
                : 'bg-transparent text-(--color-text) border-(--color-border) hover:border-(--color-accent)'
            }`}
          >
            {t(`library.categories.${c}`)}
          </button>
        ))}
      </div>
      {icons.length === 0 ? (
        <p className="m-0 py-6 text-center text-[13px] text-(--color-text-muted)">
          {t('library.noMatch')}
        </p>
      ) : (
        <div
          role="listbox"
          aria-label={t('library.gridLabel')}
          className="grid grid-cols-4 gap-2 max-h-[264px] overflow-y-auto pr-1"
        >
          {icons.map(({ name, label, Icon }) => {
            const selected = value === name
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={selected}
                title={label}
                onClick={() => onChange(name)}
                className={`h-[76px] rounded-xl border flex flex-col items-center justify-center gap-1.5 px-1 cursor-pointer transition-colors duration-150 ${
                  selected
                    ? 'border-(--color-accent) bg-(--color-accent-light) font-semibold'
                    : 'border-(--color-border) bg-transparent hover:border-(--color-accent)'
                }`}
              >
                <Icon size={22} weight="regular" color="var(--color-accent)" aria-hidden />
                <span className="text-[11px] leading-tight text-(--color-text) text-center line-clamp-2">
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

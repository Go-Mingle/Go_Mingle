import { useTranslation } from 'react-i18next'
import type { MenuOptionItem } from '../restaurantApi.types'
import { LabelTag } from './LabelTag'

interface ComboCardProps {
  item: MenuOptionItem
  priceLabel: string
}

// Spelled-out counts for small "Choice of N" values; falls back to the number.
const CHOICE_WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three' }

export function ComboCard({ item, priceLabel }: ComboCardProps) {
  const { t } = useTranslation('common')

  return (
    <div className="bg-[var(--color-card)] rounded-xl shadow-[var(--shadow-sm)] flex flex-col h-full p-5">
      {/* Header — name + price */}
      <div className="flex items-baseline justify-between gap-3 pb-3.5 mb-3.5 border-b border-[var(--color-divider)]">
        <span className="text-[17px] font-bold text-[var(--color-text)] leading-tight">
          {item.name}
        </span>
        <span className="text-[15px] font-bold text-[var(--color-accent)] whitespace-nowrap">
          {priceLabel}
        </span>
      </div>

      {/* Courses */}
      <div className="flex flex-col gap-[18px]">
        {(item.courses ?? []).map((course) => (
          <div key={course.course}>
            <div className="text-[13px] font-semibold text-[var(--color-text-muted)] mb-2.5">
              {course.course}
              {' • '}
              {t('menu.choiceOf', { count: CHOICE_WORDS[course.choose] ?? course.choose })}
            </div>
            <div className="flex flex-wrap gap-2">
              {course.options.map((option) => (
                <LabelTag key={option}>{option}</LabelTag>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

import { Eye, EyeSlash, PencilSimple, Trash } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { LabelTag } from '../../../../atoms/LabelTag'
import { HiddenNotice } from '../../components/HiddenNotice'
import type { ComboCourse, MenuOption } from '../types'

interface Props {
  option: MenuOption
  editable: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleVisibility: () => void
}

const ACTION =
  'flex h-8 w-8 items-center justify-center rounded-lg border-none bg-transparent ' +
  'text-[var(--color-text-muted)] cursor-pointer transition-colors duration-150'

/** "Choice of one" reads better than "Choice of 1" for the small counts in use. */
const CHOICE_WORDS: Record<number, string> = { 1: 'one', 2: 'two', 3: 'three' }

/**
 * One prix-fixe combo (US-02).
 *
 * Hidden combos are rendered, not filtered — the badge and the show affordance
 * are the point (AC-02.2). The eye/pencil/trash are absent entirely while
 * read-only rather than disabled (BR-10).
 */
export function MenuOptionCard({ option, editable, onEdit, onDelete, onToggleVisibility }: Props) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)] md:p-6">
      {option.isHidden && (
        <HiddenNotice
          label={t('restaurants:partnerMenu.hiddenBadge')}
          note={t('restaurants:partnerMenu.hiddenNote')}
        />
      )}

      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 truncate text-sm font-bold text-[var(--color-text)] md:text-base">
            {option.name}
          </h3>
          <div className="mt-1 text-[12px] font-bold text-[var(--color-accent)] md:text-[15px]">
            {t('restaurants:partnerMenu.price', { price: option.pricePkr.toLocaleString() })}
          </div>
        </div>

        {editable && (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={
                option.isHidden
                  ? t('restaurants:partnerMenu.showAction', { name: option.name })
                  : t('restaurants:partnerMenu.hideAction', { name: option.name })
              }
              onClick={onToggleVisibility}
              className={`${ACTION} md:hover:bg-[var(--color-hover-neutral)] md:hover:text-[var(--color-text)]`}
            >
              {option.isHidden ? <EyeSlash size={17} /> : <Eye size={17} />}
            </button>
            <button
              type="button"
              aria-label={t('restaurants:partnerMenu.editAction', { name: option.name })}
              onClick={onEdit}
              className={`${ACTION} md:hover:bg-[var(--color-accent-light)] md:hover:text-[var(--color-accent)]`}
            >
              <PencilSimple size={17} />
            </button>
            <button
              type="button"
              aria-label={t('restaurants:partnerMenu.deleteAction', { name: option.name })}
              onClick={onDelete}
              className={`${ACTION} md:hover:bg-[var(--color-error-bg)] md:hover:text-[var(--color-error)]`}
            >
              <Trash size={17} />
            </button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {option.courses.map((course, index) => (
          <CourseSection key={`${course.course}-${String(index)}`} course={course} />
        ))}
      </div>
    </div>
  )
}

function CourseSection({ course }: { course: ComboCourse }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-[var(--color-text-muted)] md:text-[13px]">
        {course.course} •{' '}
        {t('common:menu.choiceOf', { count: CHOICE_WORDS[course.choose] ?? course.choose })}
      </div>
      <div className="flex flex-wrap gap-2">
        {course.options.map((item) => (
          <LabelTag key={item}>{item}</LabelTag>
        ))}
      </div>
    </div>
  )
}

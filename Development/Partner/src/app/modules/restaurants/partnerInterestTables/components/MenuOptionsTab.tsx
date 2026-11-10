import { Alert, Spin } from 'antd'
import { ForkKnife } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { LabelTag } from '../../../../atoms/LabelTag'
import { TabEmptyState } from '../../components/TabEmptyState'
import { formatPkr } from '../../../finances/financesFormat'
import type { InterestTableMenuCourse, InterestTableMenuOption } from '../types'

/**
 * The Menu Options tab (US-02) — the combos admin assigned to this table.
 *
 * Fully read-only. Assigning and removing combos is admin-only (BR-02), so unlike
 * J6D's own Menu Options tab there is no add, edit, hide or delete affordance here.
 */
export function MenuOptionsTab({
  items,
  isPending,
  isError,
}: {
  items: InterestTableMenuOption[]
  isPending: boolean
  isError: boolean
}) {
  const { t } = useTranslation(['restaurants', 'common'])

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spin />
      </div>
    )
  }

  if (isError) {
    return <Alert type="error" message={t('common:errors.fetchError')} />
  }

  if (items.length === 0) {
    return (
      <TabEmptyState
        IconComp={ForkKnife}
        title={t('restaurants:partnerInterestTables.menuEmptyTitle')}
        description={t('restaurants:partnerInterestTables.menuEmptyDesc')}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((option) => (
        <MenuOptionCard key={option.name} option={option} />
      ))}
    </div>
  )
}

function MenuOptionCard({ option }: { option: InterestTableMenuOption }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)] md:p-6">
      <h3 className="m-0 truncate text-sm font-bold text-[var(--color-text)] md:text-base">
        {option.name}
      </h3>
      <div className="mt-1 text-[12px] font-bold text-[var(--color-accent)] md:text-[15px]">
        {formatPkr(option.pricePkr)}
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {option.courses.map((course, index) => (
          <CourseSection key={`${course.course}-${String(index)}`} course={course} />
        ))}
      </div>
    </div>
  )
}

function CourseSection({ course }: { course: InterestTableMenuCourse }) {
  const { t } = useTranslation(['restaurants', 'common'])

  return (
    <div>
      <div className="mb-2 text-[12px] font-semibold text-[var(--color-text-muted)] md:text-[13px]">
        {course.course} ·{' '}
        {t('restaurants:partnerInterestTables.chooseCount', { count: course.choose })}
      </div>
      <div className="flex flex-wrap gap-2">
        {course.options.map((item) => (
          <LabelTag key={item}>{item}</LabelTag>
        ))}
      </div>
    </div>
  )
}

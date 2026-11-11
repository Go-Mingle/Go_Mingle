import {
  CalendarBlank,
  Clock,
  Crown,
  EnvelopeSimple,
  Hourglass,
  Armchair,
  Storefront,
  Tag,
  TextAa,
  Timer,
  UsersThree,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { LabelTag } from '../../../../atoms/LabelTag'
import { ProminglerBadge } from '../../../../molecules/ProminglerBadge'
import { OverviewField } from '../../components/OverviewField'
import {
  displayAvailabilityMode,
  displayDate,
  displayDuration,
  displayTime,
  prominglerBadge,
} from '../format'
import type { InterestTableDetail } from '../types'

/**
 * The Overview tab (US-02) — the admin's table-detail fields, read-only.
 *
 * Every value comes straight from the contract. In particular the seat and guest
 * counts are **not** recomputed: the prototype derived `seatsLeft` from
 * `maxGuests - confirmedCount`, which drifted from the server's own number the
 * moment a booking was cancelled.
 *
 * No restaurant row — the partner is already scoped to one (BR-01).
 */
export function OverviewTab({ table }: { table: InterestTableDetail }) {
  const { t } = useTranslation(['restaurants', 'common'])
  const badge = prominglerBadge(table.proMingler.kind)

  const field = (name: string, IconComp: Icon, value: React.ReactNode) => (
    <OverviewField
      key={name}
      IconComp={IconComp}
      label={t(`restaurants:partnerInterestTables.fields.${name}`)}
      value={value}
    />
  )

  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-sm)] md:p-6">
      <div className="grid grid-cols-1 gap-x-6 md:grid-cols-2 xl:grid-cols-3">
        {field('name', TextAa, table.name)}
        {field('topic', Tag, table.topic || '—')}
        {field('assignedTable', Storefront, table.assignedTable || '—')}
        {field('startDate', CalendarBlank, displayDate(table.startDate))}
        {field('startTime', Clock, `${displayTime(table.startTime)} ${t('restaurants:partnerInterestTables.pkt')}`)}
        {field('duration', Timer, displayDuration(table.durationMinutes))}
        {field('minGuests', UsersThree, String(table.minGuests))}
        {field('maxGuests', UsersThree, String(table.maxGuests))}
        {field('seatsLeft', Armchair, String(table.seatsLeft))}
        {field('availability', Hourglass, displayAvailabilityMode(table.availabilityMode))}
        {field(
          'inviteOnly',
          EnvelopeSimple,
          table.inviteOnly ? (
            <LabelTag>{t('restaurants:partnerInterestTables.inviteOnly')}</LabelTag>
          ) : (
            t('restaurants:partnerInterestTables.openToAll')
          ),
        )}
        {field(
          'proMingler',
          Crown,
          badge.show ? (
            <span className="inline-flex items-center gap-2">
              {table.proMingler.name}
              <ProminglerBadge verified={badge.verified} label={false} />
            </span>
          ) : (
            '—'
          ),
        )}
        {field('created', CalendarBlank, displayDate(table.createdAt))}
      </div>
    </div>
  )
}

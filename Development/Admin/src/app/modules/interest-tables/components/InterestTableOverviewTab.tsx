import {
  Tag,
  ChatCircleText,
  Storefront,
  UsersThree,
  Clock,
  ClockCountdown,
  CheckCircle,
  CalendarBlank,
  Timer,
  ForkKnife,
  Megaphone,
} from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { formatLongDate } from '../../../../shared/utils/dateHelpers'
import { SectionCard } from '../../restaurants/restaurantDetail.utils'
import { OverviewField } from '../../restaurants/components/OverviewField'
import { SeatSquares } from './SeatSquares'
import { CountdownTimer } from './CountdownTimer'
import { InterestTableStatusBadge } from './InterestTableStatusBadge'
import { resolveMinGuests, resolveMaxGuests, resolveDurationHours } from '../tableFields'
import type { InterestTable } from '../types'

interface Props {
  table: InterestTable
}

export function InterestTableOverviewTab({ table }: Props) {
  const { t } = useTranslation('interest-tables')

  // [MET-1400] Read through the resolvers — the real API sends minGuests /
  // maxGuests / durationMinutes, not the V7 names these tiles used to read.
  const minGuests = resolveMinGuests(table)
  const maxGuests = resolveMaxGuests(table)
  const durationHours = resolveDurationHours(table)
  const seatsBooked = table.seatsBooked ?? 0

  return (
    <div className="pt-5">
      <SectionCard title={t('detail.overviewSection')}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: '0 16px' }}>
          <OverviewField IconComp={Tag} label={t('detail.fields.name')} value={table.name} />
          <OverviewField
            IconComp={ChatCircleText}
            label={t('detail.fields.topic')}
            value={table.topic?.name ?? '—'}
          />
          <OverviewField
            IconComp={Storefront}
            label={t('detail.fields.restaurant')}
            value={table.restaurant?.name ?? '—'}
          />
          <OverviewField
            IconComp={ForkKnife}
            label={t('detail.fields.assignedTable')}
            value={table.assignedTable?.name ?? '—'}
          />
          <OverviewField
            IconComp={CheckCircle}
            label={t('detail.fields.status')}
            value={<InterestTableStatusBadge status={table.status} />}
          />
          <OverviewField
            IconComp={CalendarBlank}
            label={t('detail.fields.startDate')}
            value={formatLongDate(table.startDate)}
          />
          <OverviewField
            IconComp={Clock}
            label={t('detail.fields.startTime')}
            value={table.startTime}
          />
          <OverviewField
            IconComp={ClockCountdown}
            label={t('detail.fields.duration')}
            value={
              durationHours === undefined ? '—' : t('detail.hoursValue', { count: durationHours })
            }
          />
          <OverviewField
            IconComp={UsersThree}
            label={t('detail.fields.minMinglers')}
            value={t('detail.peopleValue', { count: minGuests })}
          />
          <OverviewField
            IconComp={UsersThree}
            label={t('detail.fields.maxMinglers')}
            value={maxGuests === undefined ? '—' : t('detail.peopleValue', { count: maxGuests })}
          />
          <OverviewField
            IconComp={CheckCircle}
            label={t('detail.fields.seatsBooked')}
            value={
              maxGuests === undefined ? (
                '—'
              ) : (
                <SeatSquares booked={seatsBooked} total={maxGuests} />
              )
            }
          />
          <OverviewField
            IconComp={Timer}
            label={t('detail.fields.timeLeft')}
            value={<CountdownTimer timeLeft={table.timeLeft} status={table.status} />}
          />
          <OverviewField
            IconComp={Megaphone}
            label={t('detail.fields.sponsored')}
            value={
              table.sponsorName
                ? (table.sponsorName ?? t('detail.sponsoredYes'))
                : t('detail.sponsoredNo')
            }
          />
          <OverviewField
            IconComp={CalendarBlank}
            label={t('detail.fields.created')}
            value={formatLongDate(table.created)}
          />
        </div>
      </SectionCard>
    </div>
  )
}

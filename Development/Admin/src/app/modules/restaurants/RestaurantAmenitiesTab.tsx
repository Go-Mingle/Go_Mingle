import { ShieldCheck } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { SectionCard } from './restaurantDetail.utils'
import { AmenityIconBadge } from '../amenities/components/AmenityIconBadge'
import type { RestaurantAmenity } from './restaurantApi.types'

interface Props {
  amenities: RestaurantAmenity[]
}

export function RestaurantAmenitiesTab({ amenities }: Props) {
  const { t } = useTranslation('restaurants')

  if (amenities.length === 0) {
    return (
      <div className="pt-5">
        <div className="flex flex-col items-center gap-3 rounded-xl bg-[var(--color-card)] p-12">
          <ShieldCheck size={32} weight="regular" className="text-[var(--color-text-subtle)]" />
          <span className="font-[Poppins] text-[13px] text-[var(--color-text-muted)]">
            {t('amenities.empty')}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="pt-5">
      <SectionCard title={t('amenities.assignedTitle')}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {amenities.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-xl bg-[var(--color-card)] p-5 shadow-[var(--shadow-sm)]"
            >
              <AmenityIconBadge iconUrl={a.iconUrl} containerSize={48} size={22} />
              <div className="flex min-w-0 flex-col">
                <span className="overflow-hidden text-ellipsis font-[Poppins] text-sm font-medium text-[var(--color-text)]">
                  {a.name}
                </span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  )
}

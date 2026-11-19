import { ImageWithFallback } from '../../../atoms/ImageWithFallback'
import { MobileEmpty } from '../../../molecules/MobileEmpty'
import { Flex } from 'antd'
import { useTranslation } from 'react-i18next'
import type { Restaurant } from './restaurantsPage.types'
import { categoryColors, statusColors, statusLabels } from './restaurantsPage.types'
import { getRestaurantInitials } from '../utils/restaurantUtils'

interface RestaurantCardListProps {
  data: Restaurant[]
  onCardClick: (id: string) => void
}

export function RestaurantCardList({ data, onCardClick }: RestaurantCardListProps) {
  const { t } = useTranslation('restaurants')
  if (data.length === 0)
    return (
      <MobileEmpty
        title={t('common:mobileEmpty.restaurants.title')}
        hint={t('common:mobileEmpty.restaurants.hint')}
      />
    )

  return (
    <div className="restaurant-card-list">
      {data.map((r) => {
        const catColors = categoryColors[r.category] ?? {
          bg: 'var(--tint-neutral-bg)',
          text: 'var(--color-text-secondary)',
        }
        const statusBg = statusColors[r.status] ?? 'var(--color-text-secondary)'
        const statusLabel = statusLabels[r.status] ?? r.status

        return (
          <div
            key={r.id}
            className="restaurant-card"
            onClick={() => onCardClick(r.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onCardClick(r.id)
            }}
          >
            {/* Avatar + name + cuisine/city */}
            <Flex align="center" gap={12} style={{ marginBottom: 10 }}>
              <ImageWithFallback
                src={r.avatarUrl}
                alt={r.name}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
                fallback={
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: '50%',
                      background: r.avatarColor,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'var(--font-ui)',
                    }}
                  >
                    {getRestaurantInitials(r.name)}
                  </div>
                }
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    fontFamily: 'var(--font-ui)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-muted)',
                    fontFamily: 'var(--font-ui)',
                    marginTop: 2,
                  }}
                >
                  {r.cuisine} · {r.city}
                </div>
              </div>
            </Flex>

            {/* Badges + bookings */}
            <Flex align="center" gap={8} wrap>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 4,
                  background: catColors.bg,
                  color: catColors.text,
                  fontSize: 11,
                  fontWeight: 500,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {r.category}
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 4,
                  background: statusBg,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {statusLabel}
              </span>
              <span
                style={{
                  marginLeft: 'auto',
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                {r.bookings.toLocaleString()} {t('restaurants:table.headers.bookings', 'bookings')}
              </span>
            </Flex>
          </div>
        )
      })}
    </div>
  )
}

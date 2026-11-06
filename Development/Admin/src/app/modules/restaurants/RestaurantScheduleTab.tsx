import { Clock } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import type { TableAvailabilityWindow } from './restaurantApi.types'
import { useRestaurantTablesQuery } from './hooks/useRestaurantsQuery'

interface Props {
  restaurant: Record<string, unknown>
}

const DAY_ORDER = [
  { key: 'mon', value: 1 },
  { key: 'tue', value: 2 },
  { key: 'wed', value: 3 },
  { key: 'thu', value: 4 },
  { key: 'fri', value: 5 },
  { key: 'sat', value: 6 },
  { key: 'sun', value: 0 },
] as const

export function RestaurantScheduleTab({ restaurant }: Props) {
  const { t } = useTranslation('restaurants')
  const restaurantId = restaurant.id as string | undefined
  const { data, isLoading, isError } = useRestaurantTablesQuery(restaurantId)
  const tables = data?.items ?? []

  if (isLoading) {
    return <div className="text-[var(--color-text-muted)] p-8">Loading...</div>
  }

  if (isError) {
    return <div className="text-[var(--color-text-muted)] p-8">Unable to load table timings.</div>
  }

  if (tables.length === 0) {
    return (
      <div
        className="pt-5"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          padding: '48px 0',
        }}
      >
        <Clock size={32} weight="regular" style={{ color: 'var(--color-text-subtle)' }} />
        <span
          style={{
            fontSize: 13,
            color: 'var(--color-text-muted)',
            fontFamily: 'Poppins, sans-serif',
          }}
        >
          {t('schedule.empty')}
        </span>
      </div>
    )
  }

  return (
    <div className="pt-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tables.map((tbl) => {
          const windowsByDay = tbl.availability.reduce<Map<number, TableAvailabilityWindow[]>>(
            (acc, window) => {
              const existing = acc.get(window.dayOfWeek) ?? []
              acc.set(window.dayOfWeek, [...existing, window])
              return acc
            },
            new Map(),
          )
          return (
            <div
              key={tbl.id}
              style={{
                background: 'var(--color-card)',
                borderRadius: 12,
                boxShadow: 'var(--shadow-sm)',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Heading — table name */}
              <div
                style={{
                  paddingBottom: 12,
                  borderBottom: '1px solid var(--color-divider)',
                  fontSize: 15,
                  fontWeight: 700,
                  color: 'var(--color-text)',
                  fontFamily: 'Poppins, sans-serif',
                }}
              >
                {tbl.name}
              </div>

              {/* Per-day timings */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                <span style={LABEL}>{t('schedule.timingsLabel')}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {DAY_ORDER.map((d) => {
                    const ranges = windowsByDay.get(d.value)
                    const isOpen = !!ranges && ranges.length > 0
                    return (
                      <div
                        key={d.key}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          minHeight: 28,
                        }}
                      >
                        <span
                          style={{
                            width: 40,
                            flexShrink: 0,
                            fontSize: 12,
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            color: isOpen
                              ? 'var(--color-text-secondary)'
                              : 'var(--color-text-subtle)',
                            fontFamily: 'Poppins, sans-serif',
                          }}
                        >
                          {t(`schedule.dayShort.${d.key}`)}
                        </span>
                        {isOpen ? (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            {ranges.map((r, i) => (
                              <span
                                key={i}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: 'var(--color-coral-light)',
                                  color: 'var(--color-coral-dark)',
                                  borderRadius: 999,
                                  padding: '3px 10px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  fontFamily: 'Poppins, sans-serif',
                                }}
                              >
                                <Clock size={12} weight="bold" style={{ flexShrink: 0 }} />
                                {r.start} – {r.end}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color: 'var(--color-text-subtle)',
                              fontFamily: 'Poppins, sans-serif',
                            }}
                          >
                            {t('schedule.closed')}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const LABEL: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--color-text-subtle)',
  fontFamily: 'Poppins, sans-serif',
}

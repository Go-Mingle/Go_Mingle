import { User, Envelope, Phone, CalendarBlank, BookOpen, Star, Crown } from '@phosphor-icons/react'
import { useTranslation } from 'react-i18next'
import { Grid, Switch } from 'antd'
import { OverviewField } from './OverviewField'
import { formatLongDate } from '../../../../shared/utils/dateHelpers'

interface MinglerOverviewTabProps {
  name: string
  email: string
  phone: string
  joined: string
  bookings: number | string
  points: number | string
  /** Redesign shell — when provided, renders the Pro Mingler toggle. */
  isPromingler?: boolean
  onTogglePromingler?: (next: boolean) => void
  prominglerUpdating?: boolean
}

export function MinglerOverviewTab({
  name,
  email,
  phone,
  joined,
  bookings,
  points,
  isPromingler,
  onTogglePromingler,
  prominglerUpdating,
}: MinglerOverviewTabProps) {
  const { t } = useTranslation('minglers')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  return (
    <div
      style={{
        background: 'var(--color-card)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        padding: 24,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
          gap: '0 16px',
        }}
      >
        <OverviewField IconComp={User} label={t('overview.fullName')}>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {name}
          </span>
        </OverviewField>

        <OverviewField IconComp={Envelope} label={t('overview.email')}>
          <a
            href={`mailto:${email}`}
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-accent)',
              textDecoration: 'none',
            }}
          >
            {email}
          </a>
        </OverviewField>

        <OverviewField IconComp={Phone} label={t('overview.phone')}>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {phone}
          </span>
        </OverviewField>

        <OverviewField IconComp={CalendarBlank} label={t('overview.memberSince')}>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {formatLongDate(joined)}
          </span>
        </OverviewField>

        <OverviewField IconComp={BookOpen} label={t('overview.totalBookings')}>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {String(bookings ?? 0)}
          </span>
        </OverviewField>

        <OverviewField IconComp={Star} label={t('overview.loyaltyPoints')}>
          <span
            style={{
              fontFamily: 'Poppins, sans-serif',
              fontSize: 14,
              fontWeight: 500,
              color: 'var(--color-text)',
            }}
          >
            {t('overview.pts', { count: Number(points ?? 0).toLocaleString() })}
          </span>
        </OverviewField>

        {onTogglePromingler && (
          <OverviewField IconComp={Crown} label={t('overview.promingler')}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Switch
                checked={!!isPromingler}
                loading={prominglerUpdating}
                onChange={(v) => onTogglePromingler(v)}
              />
              <span
                style={{
                  fontFamily: 'Poppins, sans-serif',
                  fontSize: 14,
                  fontWeight: 500,
                  color: 'var(--color-text)',
                }}
              >
                {isPromingler ? t('overview.prominglerOn') : t('overview.prominglerOff')}
              </span>
            </span>
          </OverviewField>
        )}
      </div>
    </div>
  )
}

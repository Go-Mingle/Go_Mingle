import { UserCircleMinus, UserCircleCheck } from '@phosphor-icons/react'
import { Grid } from 'antd'
import { useTranslation } from 'react-i18next'
import { ProminglerBadge } from '../../../molecules/ProminglerBadge'
import { AppButton } from '../../../atoms/AppButton'
import { formatLongDate } from '../../../../shared/utils/dateHelpers'

interface MinglerHeroProps {
  name: string
  joined: string
  phone: string
  avatarBg: string
  avatarUrl?: string | null
  initials: string
  heroCfg: { bg: string; label: string }
  isActive: boolean
  onSuspend: () => void
  onUnsuspend: () => void
  /** Admin-designated Pro Mingler → shows the verified crown badge by the name. */
  isPromingler?: boolean
}

export function MinglerHero({
  name,
  joined,
  avatarBg,
  avatarUrl,
  initials,
  heroCfg,
  isActive,
  onSuspend,
  onUnsuspend,
  isPromingler,
}: MinglerHeroProps) {
  const { t } = useTranslation('minglers')
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const statusBadge = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 4,
        background: heroCfg.bg,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {heroCfg.label}
    </span>
  )

  const metaLine = (
    <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
      {t('detail.since', { date: formatLongDate(joined) })}
    </p>
  )

  if (isMobile) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          paddingBottom: 20,
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 20,
        }}
      >
        {/* Avatar + name + status badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: avatarBg,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              fontFamily: 'Poppins, sans-serif',
              overflow: 'hidden',
            }}
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              initials
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--color-text)',
                fontFamily: 'Poppins, sans-serif',
                marginBottom: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {isPromingler && <ProminglerBadge verified size={14} />}
              {statusBadge}
            </div>
          </div>
        </div>

        {/* Meta line */}
        {metaLine}

        {/* Full-width action button */}
        <AppButton
          variant={isActive ? 'danger' : 'secondary'}
          fillContainer
          onClick={isActive ? onSuspend : onUnsuspend}
          style={{ width: '100%' }}
        >
          {isActive ? (
            <>
              <UserCircleMinus size={16} weight="regular" />
              {t('hero.suspendBtn')}
            </>
          ) : (
            <>
              <UserCircleCheck size={16} weight="regular" />
              {t('hero.unsuspendBtn')}
            </>
          )}
        </AppButton>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap',
        paddingBottom: 24,
        borderBottom: '1px solid var(--color-border)',
        marginBottom: 24,
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: avatarBg,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: 20,
          fontWeight: 700,
          overflow: 'hidden',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          initials
        )}
      </div>

      {/* Name + badge + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
            marginBottom: 6,
          }}
        >
          <h1
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: 'var(--color-text)',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {name}
          </h1>
          {isPromingler && <ProminglerBadge verified size={16} />}
          {statusBadge}
        </div>
        {metaLine}
      </div>

      {/* Action button */}
      <AppButton
        variant={isActive ? 'danger' : 'secondary'}
        onClick={isActive ? onSuspend : onUnsuspend}
      >
        {isActive ? (
          <>
            <UserCircleMinus size={15} /> {t('hero.suspendBtn')}
          </>
        ) : (
          <>
            <UserCircleCheck size={15} /> {t('hero.unsuspendBtn')}
          </>
        )}
      </AppButton>
    </div>
  )
}

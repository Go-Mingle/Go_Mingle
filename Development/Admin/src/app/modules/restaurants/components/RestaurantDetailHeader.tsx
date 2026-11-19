import type { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Grid } from 'antd'
import { ArrowLeft, UserCircleMinus, UserCircleCheck, Tag as TagIcon } from '@phosphor-icons/react'
import { getRestaurantInitials } from '../utils/restaurantUtils'
import { AppButton } from '../../../atoms/AppButton'

interface StatusStyle {
  bg: string
  text: string
  label: string
}

interface RestaurantDetailHeaderProps {
  restaurant: Record<string, unknown>
  isActive: boolean
  platformStatusStyle: StatusStyle
  visibilityStyle: StatusStyle
  onChangeCategoryClick: () => void
  onSuspend: () => void
  onReactivate: () => void
  /** Suspended restaurants cannot have their category changed. */
  isSuspended?: boolean
  /** When provided, replaces the default change-category / suspend actions
   *  (used by the approval-preview mode to render Approve / Reject instead). */
  actions?: ReactNode
}

export function RestaurantDetailHeader({
  restaurant,
  isActive,
  platformStatusStyle,
  visibilityStyle,
  onChangeCategoryClick,
  onSuspend,
  onReactivate,
  isSuspended,
  actions,
}: RestaurantDetailHeaderProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation(['restaurants', 'common'])
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  // Derive the back-link label from the route so it survives tab switches and
  // page refreshes (router state is dropped when tabs update the query string
  // via setSearchParams). Detail pages opened from the Approval Queue live
  // under /approval-queue/:id; everything else is the Restaurants module.
  const backLabel = location.pathname.startsWith('/approval-queue')
    ? t('common:backTo.approvalQueue')
    : ((location.state as { backLabel?: string } | null)?.backLabel ??
      t('common:backTo.restaurants'))

  const statusBadge = (style: StatusStyle) => (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 24,
        padding: '0 10px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 600,
        fontFamily: 'var(--font-ui)',
        background: style.bg,
        color: style.text,
        flexShrink: 0,
      }}
    >
      {style.label}
    </span>
  )

  const changeCategoryBtn = (
    <AppButton variant="secondary" onClick={onChangeCategoryClick} disabled={isSuspended}>
      <TagIcon size={14} /> {t('actions.changeCategory')}
    </AppButton>
  )

  const suspendBtn = (
    <AppButton variant="danger" onClick={onSuspend}>
      <UserCircleMinus size={14} /> {t('actions.suspend')}
    </AppButton>
  )

  const unsuspendBtn = (
    <AppButton variant="secondary" onClick={onReactivate}>
      <UserCircleCheck size={14} /> {t('actions.unsuspend')}
    </AppButton>
  )

  return (
    <>
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--color-accent)] bg-transparent border-none cursor-pointer mb-6 p-0"
      >
        <ArrowLeft size={15} /> {backLabel}
      </button>

      {isMobile ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 12,
            marginBottom: 24,
            paddingBottom: 24,
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          {restaurant.avatarUrl ? (
            <img
              src={restaurant.avatarUrl as string}
              alt={restaurant.name as string}
              className="w-16 h-16 rounded-[12px] shrink-0 border border-[var(--color-border)] object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-[12px] shrink-0 border border-[var(--color-border)] flex items-center justify-center text-(--color-on-accent) font-bold font-(--font-ui) bg-[var(--color-accent)]">
              {getRestaurantInitials((restaurant.name as string) ?? '')}
            </div>
          )}
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text)',
              fontFamily: 'var(--font-ui)',
            }}
          >
            {restaurant.name as string}
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {statusBadge(platformStatusStyle)}
            {statusBadge(visibilityStyle)}
          </div>
          <p
            style={{
              fontSize: 13,
              color: 'var(--color-text-muted)',
              margin: 0,
              fontFamily: 'var(--font-ui)',
            }}
          >
            {restaurant.cuisine as string} · {restaurant.areaDistrict as string}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, width: '100%' }}>
            {actions ?? (
              <>
                {changeCategoryBtn}
                {isActive ? suspendBtn : unsuspendBtn}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="gm-profile-cover relative mb-6 overflow-hidden rounded-[28px] bg-[#14102A] shadow-[var(--shadow-md)]">
          {/* The restaurant's cover photo as the page banner (GM-337). */}
          <div className="relative h-[220px] w-full" data-testid="admin-cover-banner">
            {restaurant.coverUrl ? (
              <img
                src={restaurant.coverUrl as string}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="gm-cover-fallback absolute inset-0" aria-hidden="true" />
            )}
            <span
              className="absolute inset-0 bg-gradient-to-t from-[rgba(20,16,42,0.92)] via-[rgba(20,16,42,0.3)] to-transparent"
              aria-hidden="true"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6">
            <div className="flex items-end gap-5 min-w-0">
              {restaurant.avatarUrl ? (
                <img
                  src={restaurant.avatarUrl as string}
                  alt={restaurant.name as string}
                  className="w-[84px] h-[84px] rounded-[22px] shrink-0 border-4 border-white object-cover shadow-[var(--shadow-md)]"
                />
              ) : (
                <div className="w-[84px] h-[84px] rounded-[22px] shrink-0 border-4 border-white flex items-center justify-center text-(--color-on-accent) text-[22px] font-bold font-(--font-ui) bg-[var(--color-accent)]">
                  {getRestaurantInitials((restaurant.name as string) ?? '')}
                </div>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
                  <h1 className="m-0 text-[28px] leading-tight font-bold text-white truncate">
                    {restaurant.name as string}
                  </h1>
                  {statusBadge(platformStatusStyle)}
                  {statusBadge(visibilityStyle)}
                </div>
                <p className="text-[14px] text-white/85 m-0">
                  {restaurant.cuisine as string} · {restaurant.areaDistrict as string}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {actions ?? (
                <>
                  {changeCategoryBtn}
                  {isActive ? suspendBtn : unsuspendBtn}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

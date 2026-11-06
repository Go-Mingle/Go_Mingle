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
        fontFamily: 'Poppins, sans-serif',
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
              className="w-16 h-16 rounded-[12px] shrink-0 border border-[rgba(0,0,0,0.06)] object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-[12px] shrink-0 border border-[rgba(0,0,0,0.06)] flex items-center justify-center text-white font-bold font-[Poppins] bg-[var(--color-accent)]">
              {getRestaurantInitials((restaurant.name as string) ?? '')}
            </div>
          )}
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: 'var(--color-text)',
              fontFamily: 'Poppins, sans-serif',
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
              fontFamily: 'Poppins, sans-serif',
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
        <div className="flex items-start justify-between gap-4 mb-6 pb-6 border-b border-[var(--color-border)]">
          <div className="flex items-start gap-5">
            {restaurant.avatarUrl ? (
              <img
                src={restaurant.avatarUrl as string}
                alt={restaurant.name as string}
                className="w-16 h-16 rounded-[12px] shrink-0 border border-[rgba(0,0,0,0.06)] object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-[12px] shrink-0 border border-[rgba(0,0,0,0.06)] flex items-center justify-center text-white font-bold font-[Poppins] bg-[var(--color-accent)]">
                {getRestaurantInitials((restaurant.name as string) ?? '')}
              </div>
            )}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    color: 'var(--color-text)',
                    fontFamily: 'Poppins, sans-serif',
                  }}
                >
                  {restaurant.name as string}
                </span>
                {statusBadge(platformStatusStyle)}
                {statusBadge(visibilityStyle)}
              </div>
              <p className="text-[13px] text-[var(--color-text-muted)] m-0">
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
      )}
    </>
  )
}

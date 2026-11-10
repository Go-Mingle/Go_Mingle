import {
  Storefront,
  PauseCircle,
  XCircle,
  CheckCircle,
  ArrowCounterClockwise,
  User,
  GearSix,
  type Icon,
} from '@phosphor-icons/react'

interface NotifIconSpec {
  Component: Icon
  /** Tailwind text-colour class for the icon (static so Tailwind extracts it). */
  colorClass: string
  /** Tailwind background class for the tinted icon tile. */
  bgClass: string
}

// Notification `type` is an uppercase enum from the API (e.g.
// RESTAURANT_APPLICATION_SUBMITTED, MINGLER_SUSPENDED). We resolve icons by
// keyword so new/unknown types degrade gracefully to the gear fallback.
function resolveSpec(type: string): NotifIconSpec {
  const key = (type ?? '').toUpperCase()

  if (key.includes('UNSUSPENDED'))
    return {
      Component: ArrowCounterClockwise,
      colorClass: 'text-[var(--color-success)]',
      bgClass: 'bg-[var(--color-success-bg)]',
    }
  if (key.includes('SUSPENDED'))
    return {
      Component: PauseCircle,
      colorClass: 'text-[var(--color-error)]',
      bgClass: 'bg-[var(--color-error-bg)]',
    }
  if (key.includes('REJECTED'))
    return {
      Component: XCircle,
      colorClass: 'text-[var(--color-error)]',
      bgClass: 'bg-[var(--color-error-bg)]',
    }
  if (key.includes('APPROVED'))
    return {
      Component: CheckCircle,
      colorClass: 'text-[var(--color-success)]',
      bgClass: 'bg-[var(--color-success-bg)]',
    }
  if (key.includes('APPLICATION'))
    return {
      Component: Storefront,
      colorClass: 'text-[var(--color-accent)]',
      bgClass: 'bg-[var(--color-accent-light)]',
    }
  if (key.startsWith('MINGLER'))
    return {
      Component: User,
      colorClass: 'text-[var(--color-accent)]',
      bgClass: 'bg-[var(--color-accent-light)]',
    }

  return {
    Component: GearSix,
    colorClass: 'text-[var(--color-text-muted)]',
    bgClass: 'bg-[var(--color-divider)]',
  }
}

/** Renders the per-type notification icon. */
export function notificationIcon(type: string, size = 18) {
  const { Component, colorClass } = resolveSpec(type)
  return <Component size={size} className={`shrink-0 ${colorClass}`} />
}

/** Tailwind background class for the tinted icon tile of a notification type. */
export function notificationIconBgClass(type: string): string {
  return resolveSpec(type).bgClass
}

import {
  Bell,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  UserMinus,
  UsersThree,
  type IconProps,
} from '@phosphor-icons/react'
import type { ComponentType } from 'react'

interface NotifMeta {
  Icon: ComponentType<IconProps>
  colorClass: string
  /** A token name rather than a raw value, so the tint stays themeable. */
  bgClass: string
}

/**
 * Visual metadata for J7's five notification types (spec §3.1).
 *
 * Replaces the prototype's nine lowercase keys: J7 dropped *new review posted*,
 * *profile approved*, *profile rejected* and *category changed* — all four are email-only
 * and have no inbox representation — and renamed the rest to the canonical UPPER_SNAKE
 * catalogue keys.
 */
const META: Record<string, NotifMeta> = {
  IT_CANCELLED: {
    Icon: CalendarX,
    colorClass: 'text-[var(--color-error)]',
    bgClass: 'bg-[var(--color-error-bg)]',
  },
  IT_CONFIRMED: {
    Icon: CalendarCheck,
    colorClass: 'text-[var(--color-success)]',
    bgClass: 'bg-[var(--color-success-bg)]',
  },
  IT_CREATED: {
    Icon: CalendarPlus,
    colorClass: 'text-[var(--color-accent)]',
    bgClass: 'bg-[var(--color-accent-light)]',
  },
  MINGLER_CANCELLED_BOOKING: {
    Icon: UserMinus,
    colorClass: 'text-[var(--color-warning)]',
    bgClass: 'bg-[var(--color-warning-bg)]',
  },
  PROMINGLER_UPDATED: {
    Icon: UsersThree,
    colorClass: 'text-[var(--color-info)]',
    bgClass: 'bg-[var(--color-info-bg)]',
  },
}

/**
 * The fallback for a type this client has never heard of.
 *
 * `type` is a plain string on the wire and an unrecognised value is **legal** — the
 * backend may add a type before the frontend ships support for it, and such a row must
 * still render and stay clickable (BR-02).
 *
 * The prototype had no fallback: it did `const { Icon } = META[type]`, which destructures
 * `undefined` and **throws**, taking the whole notifications surface down with it. A
 * neutral bell is the right answer — it says "something happened" without inventing a
 * meaning the client cannot know.
 */
const UNKNOWN: NotifMeta = {
  Icon: Bell,
  colorClass: 'text-[var(--color-text-muted)]',
  bgClass: 'bg-[var(--color-page)]',
}

/** Never throws on an unrecognised key — see {@link UNKNOWN}. */
export function notifMeta(type: string): NotifMeta {
  return META[type] ?? UNKNOWN
}

/** True when this client recognises the type. Only used to reason about coverage. */
export function isKnownNotificationType(type: string): boolean {
  return type in META
}

export function notifIcon(type: string, size = 16) {
  const { Icon, colorClass } = notifMeta(type)
  return <Icon size={size} className={`shrink-0 ${colorClass}`} />
}

/** The Tailwind class for the icon's circular tint. */
export function notifIconBgClass(type: string): string {
  return notifMeta(type).bgClass
}

import { createElement, memo } from 'react'
import DOMPurify from 'dompurify'
import {
  WifiHigh,
  Wheelchair,
  Car,
  Umbrella,
  Waves,
  Buildings,
  Tree,
  Drop,
  Baby,
  Laptop,
  ShieldCheck,
  Toilet,
  DiamondsFour,
  Camera,
  Martini,
  MusicNote,
  Heart,
  UsersThree,
  HandsPraying,
  Snowflake,
  Lightning,
  CreditCard,
  DoorOpen,
  Cigarette,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'

const amenityIconMap: Record<string, Icon> = {
  WifiHigh,
  Wheelchair,
  Car,
  Umbrella,
  Waves,
  Buildings,
  Tree,
  Drop,
  Baby,
  Laptop,
  ShieldCheck,
  Toilet,
  DiamondsFour,
  Camera,
  Martini,
  MusicNote,
  Heart,
  UsersThree,
  HandsPraying,
  Snowflake,
  Lightning,
  CreditCard,
  DoorOpen,
  Cigarette,
}

interface AmenityIconBadgeProps {
  iconUrl: string | null
  /**
   * Cache-buster appended to the `<img>` request. The API replaces an amenity
   * icon at a stable CDN key, so `iconUrl` is byte-identical before and after an
   * update and the browser keeps serving the previously cached file. Pass the
   * amenity's `updatedAt`, or a token bumped after a fresh upload.
   */
  version?: string | number | null
  size?: number
  containerSize?: number
  /** Tailwind background class. Defaults to the accent tint; the Amenities
   *  page passes the neutral page background to match the source-of-truth UI. */
  bgClassName?: string
}

/** Appends `v=<version>` to a URL, preserving any existing query and hash. */
function withVersion(url: string, version: string | number): string {
  const hashAt = url.indexOf('#')
  const base = hashAt === -1 ? url : url.slice(0, hashAt)
  const hash = hashAt === -1 ? '' : url.slice(hashAt)
  const separator = base.includes('?') ? '&' : '?'
  return `${base}${separator}v=${encodeURIComponent(String(version))}${hash}`
}

export const AmenityIconBadge = memo(function AmenityIconBadge({
  iconUrl,
  version,
  size = 18,
  containerSize = 36,
  bgClassName = 'bg-[var(--color-accent-light)]',
}: AmenityIconBadgeProps) {
  const value = typeof iconUrl === 'string' ? iconUrl.trim() : ''
  const isSvgMarkup = value.toLowerCase().startsWith('<svg')
  // The real API returns a CDN URL to the uploaded SVG — render it as an image.
  const isUrl = /^https?:\/\//i.test(value) || value.startsWith('/') || /\.svg(\?|#|$)/i.test(value)
  // Legacy/mock icons are stored as a Phosphor icon name; null falls back to
  // the built-in shield so the current UI is preserved when no icon is given.
  const phosphorIcon = !isSvgMarkup && !isUrl && value ? (amenityIconMap[value] ?? null) : null
  const hasVersion = version !== undefined && version !== null && version !== ''
  const imgSrc = isUrl && hasVersion ? withVersion(value, version) : value

  return (
    <div
      style={{ width: containerSize, height: containerSize }}
      className={`rounded-lg ${bgClassName} flex items-center justify-center shrink-0 text-[var(--color-accent)] overflow-hidden`}
    >
      {isSvgMarkup ? (
        <div
          aria-hidden
          style={{ width: size, height: size }}
          className="flex items-center justify-center text-[var(--color-accent)]"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }}
        />
      ) : isUrl ? (
        <img
          src={imgSrc}
          alt=""
          loading="lazy"
          style={{ width: size, height: size }}
          className="object-contain"
        />
      ) : (
        createElement(phosphorIcon ?? ShieldCheck, {
          size,
          weight: 'regular',
          color: 'var(--color-accent)',
        })
      )}
    </div>
  )
})

import { useState } from 'react'
import { getInitials, getAvatarBg } from '../../shared/utils/avatar'

interface TableAvatarProps {
  /** Name used both for the initials fallback and the deterministic colour. */
  name: string
  /** Image URL; when absent or it fails to load, initials are shown instead. */
  imageUrl?: string | null
  /** Square size in px (default 32). */
  size?: number
  /** Circle (default) for people, rounded square for events/tables. */
  shape?: 'circle' | 'rounded'
  /** Explicit corner radius (px); overrides the shape-derived radius. */
  radius?: number
  /** Optional override for the initials background colour. */
  color?: string
  alt?: string
}

/**
 * Listing-table avatar cell. Renders the image when one is available and loads
 * successfully; otherwise falls back to the name's initials on a deterministic
 * colour. Used across every listing table so a missing/broken image never
 * leaves an empty box.
 */
export function TableAvatar({
  name,
  imageUrl,
  size = 32,
  shape = 'circle',
  radius,
  color,
  alt,
}: TableAvatarProps) {
  const [errored, setErrored] = useState(false)
  const borderRadius = radius ?? (shape === 'circle' ? '50%' : 8)
  const showImage = Boolean(imageUrl) && !errored

  if (showImage) {
    return (
      <img
        src={imageUrl as string}
        alt={alt ?? name}
        loading="lazy"
        onError={() => setErrored(true)}
        style={{
          width: size,
          height: size,
          borderRadius,
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <span
      aria-label={alt ?? name}
      style={{
        width: size,
        height: size,
        borderRadius,
        background: color ?? getAvatarBg(name),
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.round(size * 0.375),
        fontWeight: 600,
        letterSpacing: '0.02em',
        fontFamily: 'Poppins, sans-serif',
        flexShrink: 0,
      }}
    >
      {getInitials(name)}
    </span>
  )
}

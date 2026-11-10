// Canonical avatar helpers shared across every listing table / avatar cell.
// Previously duplicated per-module (minglers, restaurants, approval-queue, …);
// this is the single source of truth. Module-local copies re-export from here.

export const AVATAR_PALETTE = ['#FF6B5B', '#0FA79D', '#1565C0', '#B06000', '#6B21A8']

/** Deterministically map a name to a palette colour (stable across renders). */
export function getAvatarBg(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

/** First + last word initials (or first two letters of a single word). */
export function getInitials(name: string): string {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

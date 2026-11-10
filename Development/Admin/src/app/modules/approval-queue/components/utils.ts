import type React from 'react'

export const AVATAR_PALETTE = [
  { bg: 'var(--tint-teal-bg)', text: 'var(--tint-teal-fg)' },
  { bg: 'var(--tint-coral-bg)', text: 'var(--tint-coral-fg)' },
  { bg: 'var(--tint-blue-bg)', text: 'var(--tint-blue-fg)' },
  { bg: 'var(--tint-amber-bg)', text: 'var(--tint-amber-fg)' },
  { bg: 'var(--tint-violet-bg)', text: 'var(--tint-violet-fg)' },
]

export function getAvatarColor(name: string) {
  let h = 0
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

export function getInitials(owner: string) {
  return owner
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export const notProvidedStyle: React.CSSProperties = {
  fontSize: 13,
  fontStyle: 'italic',
  color: 'var(--color-text-subtle)',
}

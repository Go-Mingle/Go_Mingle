import type React from 'react'

export const AVATAR_PALETTE = [
  { bg: '#E6F7F6', text: '#0C8C84' },
  { bg: '#FFF0EE', text: '#E5503F' },
  { bg: '#EEF4FF', text: '#1565C0' },
  { bg: '#FFF8EC', text: '#B06000' },
  { bg: '#F5F0FF', text: '#6B46C1' },
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

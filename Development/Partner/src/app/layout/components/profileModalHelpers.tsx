export function getStrength(pw: string): number {
  if (!pw) return 0
  if (pw.length >= 8 && /[0-9]/.test(pw) && /[^A-Za-z0-9]/.test(pw)) return 4
  if (pw.length >= 6 && /[0-9]/.test(pw)) return 3
  if (pw.length >= 6) return 2
  return 1
}

export const S_COLORS = [
  '',
  'var(--color-error)',
  '#E67E22',
  'var(--color-warning)',
  'var(--color-accent)',
]

export const S_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

// Canonical form-field label (was a shared CSSProperties object). Tailwind-only.
export const labelClass =
  'block mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]'

/** "Hira Mansoor" -> "HM". Used by the topbar avatar. */
export function initialsOf(fullName: string): string {
  return fullName
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

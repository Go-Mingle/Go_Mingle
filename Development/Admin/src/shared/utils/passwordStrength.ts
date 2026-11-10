export const STRENGTH_COLORS = [
  'var(--color-error)',
  'var(--color-warning)',
  'var(--color-warning)',
  'var(--color-success)',
]

export function getStrength(pw: string): number {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

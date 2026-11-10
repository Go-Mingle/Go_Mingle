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

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: 'var(--color-text-muted)',
  display: 'block',
  marginBottom: 6,
}

export const coralBtn: React.CSSProperties = {
  background: 'var(--color-accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 12,
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '0 18px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

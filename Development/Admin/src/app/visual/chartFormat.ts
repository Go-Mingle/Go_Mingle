const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-11-16" → "16 Nov". The dates are calendar days, so no time zone is involved. */
export function shortDay(date: string): string {
  const [, m, d] = date.split('-')
  return `${Number(d)} ${MONTHS[Number(m) - 1] ?? ''}`
}

/** 12400 → "12.4k"; axis ticks only, exact values are in the tooltip. */
export function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${+(n / 1_000).toFixed(1)}k`
  return String(n)
}

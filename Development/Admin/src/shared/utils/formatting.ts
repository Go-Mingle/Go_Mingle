export function formatCurrency(amount: number, currency = 'PKR'): string {
  return `${currency} ${amount.toLocaleString()}`
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function formatDate(date: string): string {
  // A bare YYYY-MM-DD is a calendar day, not a moment: read it as UTC and print
  // it in UTC so the day never shifts with the viewer's time zone.
  const dayOnly = /^\d{4}-\d{2}-\d{2}$/.test(date)
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(dayOnly ? { timeZone: 'UTC' } : {}),
  })
}

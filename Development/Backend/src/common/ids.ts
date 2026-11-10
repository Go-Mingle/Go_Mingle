let last = 0

/** `${prefix}${Date.now()}`, never repeating within this process. */
export function stampId(prefix: string): string {
  const now = Math.max(Date.now(), last + 1)
  last = now
  return `${prefix}${now}`
}

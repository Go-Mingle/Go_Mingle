import { useEffect, useState } from 'react'

/**
 * Returns `value` delayed by `delayMs`, resetting the timer on every change.
 * Used to keep keystroke-driven inputs (search boxes, live availability checks)
 * from firing a request per character.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [delayMs, value])

  return debouncedValue
}

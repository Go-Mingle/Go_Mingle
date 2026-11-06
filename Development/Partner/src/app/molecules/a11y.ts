import type { KeyboardEvent } from 'react'

/**
 * onKeyDown handler that activates a `role="button"` element on Enter/Space,
 * mirroring native <button> keyboard behavior (WCAG 2.1.1). Pair with
 * `tabIndex={0}` on the element.
 */
export function activateOnKey(activate: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      activate()
    }
  }
}

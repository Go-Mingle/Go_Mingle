import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const mq = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(QUERY) : null
  mq?.addEventListener?.('change', onChange)
  return () => mq?.removeEventListener?.('change', onChange)
}

/** True when motion should be skipped: the person asked for less, or there is no browser to animate in. */
export function motionOff(): boolean {
  if (import.meta.env.MODE === 'test') return true
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia(QUERY).matches
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, motionOff, () => true)
}

/**
 * Replays the page-enter animation on an element whenever `key` changes
 * (the route path), without remounting anything inside it.
 */
export function usePageEnter(ref: RefObject<HTMLElement | null>, key: string) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.classList.remove('gm-page-enter')
    // Reading layout restarts the animation when the class comes back.
    void el.offsetWidth
    el.classList.add('gm-page-enter')
  }, [ref, key])
}

/**
 * A class to put on a badge for a moment after its value changes, so a status
 * change is seen where it happened. Empty on first render.
 */
export function useChangePulse(value: string | number | null | undefined, ms = 1700): string {
  const previous = useRef(value)
  const [pulsing, setPulsing] = useState(false)
  useEffect(() => {
    if (previous.current === value) return
    previous.current = value
    const start = setTimeout(() => setPulsing(true), 0)
    const stop = setTimeout(() => setPulsing(false), ms)
    return () => {
      clearTimeout(start)
      clearTimeout(stop)
    }
  }, [value, ms])
  return pulsing ? 'gm-status-changed' : ''
}

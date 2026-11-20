import { flushSync } from 'react-dom'
import { useThemeStore, type ThemeMode } from './themeStore'

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void>; finished: Promise<void> }
}

const reducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Switches the theme with motion: the new theme spreads out in a circle from
 * the button that was pressed (View Transitions), or the colours fade over
 * 400 ms where the browser can't do that. Instant under reduced motion.
 */
export function transitionTheme(mode: ThemeMode, from?: { x: number; y: number }) {
  const store = useThemeStore.getState()
  if (store.mode === mode) return
  const apply = () => flushSync(() => store.setMode(mode))
  if (reducedMotion()) return apply()

  const doc = document as ViewTransitionDoc
  const root = document.documentElement
  if (typeof doc.startViewTransition !== 'function') {
    root.classList.add('gm-theme-fade')
    apply()
    window.setTimeout(() => root.classList.remove('gm-theme-fade'), 450)
    return
  }

  const x = from?.x ?? window.innerWidth - 40
  const y = from?.y ?? 40
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  // The circle is a CSS animation driven by these variables, so it is in place
  // from the very first frame of the transition. (Starting it from JavaScript
  // after `ready` showed the new theme uncovered for a frame: the flash.)
  root.style.setProperty('--gm-vt-x', `${x}px`)
  root.style.setProperty('--gm-vt-y', `${y}px`)
  root.style.setProperty('--gm-vt-r', `${Math.ceil(radius)}px`)
  root.classList.add('gm-theme-vt')
  const done = () => {
    root.classList.remove('gm-theme-vt')
    root.style.removeProperty('--gm-vt-x')
    root.style.removeProperty('--gm-vt-y')
    root.style.removeProperty('--gm-vt-r')
  }
  const vt = doc.startViewTransition(apply)
  vt.finished.then(done, done)
}

/** Centre of the element that was clicked, for the circle to start from. */
export const originOf = (e: { currentTarget: Element }) => {
  const r = e.currentTarget.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

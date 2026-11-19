import { flushSync } from 'react-dom'
import { useThemeStore, type ThemeMode } from './themeStore'

type ViewTransitionDoc = Document & {
  startViewTransition?: (update: () => void) => { ready: Promise<void> }
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
  root.classList.add('gm-theme-vt')
  const vt = doc.startViewTransition(apply)
  vt.ready
    .then(() => {
      const anim = root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        {
          duration: 600,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
          pseudoElement: '::view-transition-new(root)',
        },
      )
      anim.finished.finally(() => root.classList.remove('gm-theme-vt'))
    })
    .catch(() => root.classList.remove('gm-theme-vt'))
}

/** Centre of the element that was clicked, for the circle to start from. */
export const originOf = (e: { currentTarget: Element }) => {
  const r = e.currentTarget.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

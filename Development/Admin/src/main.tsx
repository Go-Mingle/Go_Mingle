import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import './styles/visual.css'
import { App } from './app/App'
import { isMocksEnabled } from './shared/api/mocksEnabled'
import { initSessionChannel } from './shared/api/sessionManager'
import { initSentry } from './configs/sentry'
import { initTheme } from './shared/theme/themeStore'

// A-11 — validated before init; a placeholder DSN silently discarded every event.
initSentry()

// Light / dark theme on <html> before the first paint (no flash of the wrong theme).
initTheme()

/**
 * Fades out the app-start splash in index.html once the app has painted. It
 * stays at least long enough for the table to finish drawing (about a second),
 * so a fast load does not flash it.
 */
function hideSplash() {
  const splash = document.getElementById('gm-splash')
  if (!splash) return
  const shownFor = performance.now()
  const wait = Math.max(0, 1100 - shownFor)
  window.setTimeout(() => {
    splash.classList.add('gm-splash--out')
    window.setTimeout(() => splash.remove(), 400)
  }, wait)
}

async function bootstrap() {
  // FE1 BR-09 — a termination in any tab signs every tab out.
  initSessionChannel()

  if (isMocksEnabled()) {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
  requestAnimationFrame(hideSplash)
}

bootstrap()

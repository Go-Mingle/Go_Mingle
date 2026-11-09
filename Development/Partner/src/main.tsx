import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './app/App'
import { initSentry } from './shared/observability/sentry'
import { initTheme } from './shared/theme/themeStore'

// First statement in the module, so a failure anywhere below — including in the
// mock worker bootstrap — is reported rather than lost to a blank page.
initSentry()

// Light / dark theme on <html> before the first paint (no flash of the wrong theme).
initTheme()

/**
 * Mocks are on by default in dev and off in a production build, but
 * `VITE_ENABLE_MOCKS` overrides both ways:
 *
 *   'true'   — everything mocked
 *   'legacy' — only the unversioned prototype endpoints; `/api/v1/partner/*`
 *              goes to the real backend (see mocks/browser.ts)
 *   'false'  — no mocks at all
 *
 * The `false` opt-out is what lets dev run against a real backend — without it
 * MSW would intercept `/api/v1/partner/*` and mask the integration entirely.
 */
function mocksEnabled(): boolean {
  const flag = import.meta.env.VITE_ENABLE_MOCKS
  if (flag === 'true' || flag === 'legacy') return true
  if (flag === 'false') return false
  return import.meta.env.DEV
}

async function bootstrap() {
  if (mocksEnabled()) {
    const { worker } = await import('./mocks/browser')
    await worker.start({ onUnhandledRequest: 'bypass' })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

bootstrap()

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import { App } from './app/App'
import { isMocksEnabled } from './shared/api/mocksEnabled'
import { initSessionChannel } from './shared/api/sessionManager'
import { initSentry } from './configs/sentry'

// A-11 — validated before init; a placeholder DSN silently discarded every event.
initSentry()

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
}

bootstrap()

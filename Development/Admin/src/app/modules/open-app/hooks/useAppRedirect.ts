import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  DEEP_LINK_FALLBACK_MS,
  buildDeepLink,
  detectPlatform,
  getAppRedirectConfig,
  resolveFallbackUrl,
} from '../utils/appRedirect'
import { openUrl, replaceUrl } from '../utils/navigation'

/**
 * Drives the /open-app hand-off, entirely client side:
 *
 * 1. Reads `type` and `id` (or `code`) off the query string.
 * 2. On a phone/tablet, fires the custom-scheme deep link. If the app is
 *    installed the OS switches to it and this tab is backgrounded.
 * 3. If the tab is still in the foreground after ~1.4s the app clearly did not
 *    open, so the user is sent to their platform's store. Desktop skips the
 *    deep link entirely and goes straight to the web fallback.
 *
 * Backgrounding is detected via `visibilitychange`/`pagehide`/`blur`; any of
 * them cancels the pending store redirect so a user who *did* land in the app
 * does not come back to a store page.
 */
export function useAppRedirect(): void {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type')
  const id = searchParams.get('id') ?? searchParams.get('code')

  // React 19 StrictMode double-invokes effects in dev. The effect below must
  // still re-run in full (its cleanup tears down the listeners and timer), so
  // only the one-shot outbound navigation is guarded against firing twice.
  const navigatedRef = useRef(false)

  useEffect(() => {
    const config = getAppRedirectConfig()
    const platform = detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
    const fallbackUrl = resolveFallbackUrl(platform, config)

    if (platform === 'desktop') {
      if (!navigatedRef.current) {
        navigatedRef.current = true
        replaceUrl(fallbackUrl)
      }
      return
    }

    let timer: ReturnType<typeof setTimeout> | undefined

    const onVisibilityChange = () => {
      if (document.hidden) cancel()
    }

    function cancel() {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', cancel)
      window.removeEventListener('blur', cancel)
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', cancel)
    window.addEventListener('blur', cancel)

    const deepLink = buildDeepLink(config.scheme, type, id)
    if (deepLink && !navigatedRef.current) {
      navigatedRef.current = true
      openUrl(deepLink)
    }

    timer = setTimeout(() => {
      cancel()
      if (!document.hidden) replaceUrl(fallbackUrl)
    }, DEEP_LINK_FALLBACK_MS)

    return cancel
  }, [type, id])
}

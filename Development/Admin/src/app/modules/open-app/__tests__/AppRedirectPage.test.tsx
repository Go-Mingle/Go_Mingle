import { StrictMode } from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, screen } from '@testing-library/react'
import { renderWithProviders } from '../../../../test-utils/renderWithProviders'

// Full-page navigation cannot happen in jsdom, so the redirect flow's only two
// exits are stubbed and asserted on directly.
const openUrl = vi.fn()
const replaceUrl = vi.fn()
vi.mock('../utils/navigation', () => ({
  openUrl: (url: string) => openUrl(url),
  replaceUrl: (url: string) => replaceUrl(url),
}))

vi.mock('../../../../configs/env', () => ({
  ENV: {
    APP_DEEP_LINK_SCHEME: 'gomingle',
    IOS_APP_ID: '1234567890',
    ANDROID_PACKAGE_NAME: 'com.gomingle.app',
    WEB_FALLBACK_URL: 'https://gomingle.com',
  },
}))

const { AppRedirectPage } = await import('../AppRedirectPage')

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/122.0.0.0 Mobile Safari/537.36'
const WINDOWS = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36'

const APP_STORE = 'https://apps.apple.com/app/id1234567890'
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.gomingle.app'

function setUserAgent(userAgent: string, maxTouchPoints = 5) {
  Object.defineProperty(navigator, 'userAgent', { value: userAgent, configurable: true })
  Object.defineProperty(navigator, 'maxTouchPoints', { value: maxTouchPoints, configurable: true })
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { value: hidden, configurable: true })
}

function renderAt(route: string) {
  return renderWithProviders(<AppRedirectPage />, { route })
}

/** Advances past the deep-link grace period and flushes the pending timer. */
function runFallbackTimer() {
  act(() => {
    vi.advanceTimersByTime(2000)
  })
}

describe('AppRedirectPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    openUrl.mockClear()
    replaceUrl.mockClear()
    setHidden(false)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the redirecting message', () => {
    setUserAgent(IPHONE)
    renderAt('/open-app?type=table&id=123')
    expect(screen.getByText('Opening GoMingle App…')).toBeInTheDocument()
    expect(screen.getByText('If you are not redirected, please wait a moment.')).toBeInTheDocument()
  })

  it('attempts the custom-scheme deep link first on iOS', () => {
    setUserAgent(IPHONE)
    renderAt('/open-app?type=table&id=123')
    expect(openUrl).toHaveBeenCalledWith('gomingle://table/123')
    expect(replaceUrl).not.toHaveBeenCalled()
  })

  it('falls back to the App Store when the app does not open', () => {
    setUserAgent(IPHONE)
    renderAt('/open-app?type=table&id=123')
    runFallbackTimer()
    expect(replaceUrl).toHaveBeenCalledWith(APP_STORE)
  })

  it('falls back to the Play Store on Android', () => {
    setUserAgent(ANDROID)
    renderAt('/open-app?type=table&id=123')
    expect(openUrl).toHaveBeenCalledWith('gomingle://table/123')
    runFallbackTimer()
    expect(replaceUrl).toHaveBeenCalledWith(PLAY_STORE)
  })

  it('accepts a referral `code` in place of `id`', () => {
    setUserAgent(ANDROID)
    renderAt('/open-app?type=referral&code=XY9-ab')
    expect(openUrl).toHaveBeenCalledWith('gomingle://referral/XY9-ab')
  })

  it('goes straight to the web fallback on desktop, without a deep link', () => {
    setUserAgent(WINDOWS, 0)
    renderAt('/open-app?type=table&id=123')
    expect(openUrl).not.toHaveBeenCalled()
    expect(replaceUrl).toHaveBeenCalledWith('https://gomingle.com')
  })

  it('still sends the user to the store when the params are missing', () => {
    setUserAgent(IPHONE)
    renderAt('/open-app')
    expect(openUrl).not.toHaveBeenCalled()
    runFallbackTimer()
    expect(replaceUrl).toHaveBeenCalledWith(APP_STORE)
  })

  it('does not build a deep link from unsafe params', () => {
    setUserAgent(IPHONE)
    renderAt('/open-app?type=table&id=..%2Fevil')
    expect(openUrl).not.toHaveBeenCalled()
  })

  it('cancels the store redirect once the tab is backgrounded (app opened)', () => {
    setUserAgent(ANDROID)
    renderAt('/open-app?type=table&id=123')
    act(() => {
      setHidden(true)
      document.dispatchEvent(new Event('visibilitychange'))
    })
    runFallbackTimer()
    expect(replaceUrl).not.toHaveBeenCalled()
  })

  it('cancels the store redirect on blur', () => {
    setUserAgent(ANDROID)
    renderAt('/open-app?type=table&id=123')
    act(() => {
      window.dispatchEvent(new Event('blur'))
    })
    runFallbackTimer()
    expect(replaceUrl).not.toHaveBeenCalled()
  })

  it('does not redirect after the page is unmounted', () => {
    setUserAgent(ANDROID)
    const { unmount } = renderAt('/open-app?type=table&id=123')
    unmount()
    runFallbackTimer()
    expect(replaceUrl).not.toHaveBeenCalled()
  })

  // StrictMode runs effect → cleanup → effect. The second run must re-arm the
  // listeners and the fallback timer that the cleanup tore down, while the deep
  // link itself is attempted only once.
  it('still redirects under StrictMode, without a duplicate deep link', () => {
    setUserAgent(ANDROID)
    renderWithProviders(
      <StrictMode>
        <AppRedirectPage />
      </StrictMode>,
      { route: '/open-app?type=table&id=123' },
    )
    expect(openUrl).toHaveBeenCalledTimes(1)
    runFallbackTimer()
    expect(replaceUrl).toHaveBeenCalledWith(PLAY_STORE)
  })
})

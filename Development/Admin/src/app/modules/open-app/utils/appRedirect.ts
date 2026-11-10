import { ENV } from '../../../../configs/env'

export type DevicePlatform = 'ios' | 'android' | 'desktop'

/**
 * Delay before giving up on the custom-scheme deep link and sending the user to
 * the store. Long enough for the OS to swap to the app on a slow device, short
 * enough that a user without the app is not left staring at a blank screen.
 */
export const DEEP_LINK_FALLBACK_MS = 1400

/**
 * Shape of the deep link/store targets, resolved from build-time env vars so QA,
 * staging and production can each point at their own app scheme and listings.
 */
export interface AppRedirectConfig {
  scheme: string
  iosAppId: string
  androidPackageName: string
  webFallbackUrl: string
}

export function getAppRedirectConfig(): AppRedirectConfig {
  return {
    scheme: ENV.APP_DEEP_LINK_SCHEME,
    iosAppId: ENV.IOS_APP_ID,
    androidPackageName: ENV.ANDROID_PACKAGE_NAME,
    webFallbackUrl: ENV.WEB_FALLBACK_URL,
  }
}

/**
 * `type` and `id` come straight off the query string and are interpolated into a
 * URL we then navigate to, so both are allow-listed rather than escaped: only
 * plain slug/identifier characters get through. Anything else (a `/`, a `:`, a
 * second scheme) is rejected and the user is treated as having no deep link.
 */
const TYPE_PATTERN = /^[a-z][a-z0-9-]{0,31}$/i
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

/**
 * iPadOS 13+ reports a desktop Safari user agent, so a touch-capable
 * "Macintosh" is treated as iOS. `maxTouchPoints` is passed in rather than read
 * off `navigator` to keep this function pure and testable.
 */
export function detectPlatform(userAgent: string, maxTouchPoints = 0): DevicePlatform {
  if (/android/i.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  if (/macintosh/i.test(userAgent) && maxTouchPoints > 1) return 'ios'
  return 'desktop'
}

/**
 * Builds `<scheme>://<type>/<id>` — e.g. `gomingle://table/123`. Returns null
 * when either param is missing or fails validation, which callers treat as
 * "no app target known, go straight to the store".
 */
export function buildDeepLink(
  scheme: string,
  type: string | null,
  id: string | null,
): string | null {
  if (!scheme || !type || !id) return null
  if (!TYPE_PATTERN.test(type) || !ID_PATTERN.test(id)) return null
  return `${scheme}://${type}/${id}`
}

export function buildIosStoreUrl(appId: string): string | null {
  return /^\d{6,}$/.test(appId) ? `https://apps.apple.com/app/id${appId}` : null
}

export function buildAndroidStoreUrl(packageName: string): string | null {
  return /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(packageName)
    ? `https://play.google.com/store/apps/details?id=${packageName}`
    : null
}

/**
 * Where to send a user who did not end up in the app. Falls back to the web URL
 * whenever the platform's store identifier is unconfigured, so a missing env var
 * degrades to the marketing site instead of a broken store link.
 */
export function resolveFallbackUrl(platform: DevicePlatform, config: AppRedirectConfig): string {
  if (platform === 'ios') return buildIosStoreUrl(config.iosAppId) ?? config.webFallbackUrl
  if (platform === 'android')
    return buildAndroidStoreUrl(config.androidPackageName) ?? config.webFallbackUrl
  return config.webFallbackUrl
}

import { describe, it, expect } from 'vitest'
import {
  buildAndroidStoreUrl,
  buildDeepLink,
  buildIosStoreUrl,
  detectPlatform,
  resolveFallbackUrl,
  type AppRedirectConfig,
} from '../utils/appRedirect'

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
const IPADOS =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15'
const ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36'
const WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const CONFIG: AppRedirectConfig = {
  scheme: 'gomingle',
  iosAppId: '1234567890',
  androidPackageName: 'com.gomingle.app',
  webFallbackUrl: 'https://gomingle.com',
}

describe('detectPlatform', () => {
  it('detects iPhone as ios', () => {
    expect(detectPlatform(IPHONE)).toBe('ios')
  })

  it('detects Android as android', () => {
    expect(detectPlatform(ANDROID)).toBe('android')
  })

  it('detects desktop', () => {
    expect(detectPlatform(WINDOWS)).toBe('desktop')
  })

  it('treats a touch-capable "Macintosh" as ios (iPadOS 13+ desktop UA)', () => {
    expect(detectPlatform(IPADOS, 5)).toBe('ios')
  })

  it('keeps a real Mac (no touch points) on desktop', () => {
    expect(detectPlatform(IPADOS, 0)).toBe('desktop')
  })

  it('falls back to desktop for an empty user agent', () => {
    expect(detectPlatform('')).toBe('desktop')
  })
})

describe('buildDeepLink', () => {
  it('builds scheme://type/id', () => {
    expect(buildDeepLink('gomingle', 'table', '123')).toBe('gomingle://table/123')
  })

  it('accepts referral codes with dashes and underscores', () => {
    expect(buildDeepLink('gomingle', 'referral', 'AB_c-9')).toBe('gomingle://referral/AB_c-9')
  })

  it.each([
    ['missing type', null, '123'],
    ['missing id', 'table', null],
    ['empty id', 'table', ''],
    ['path traversal in id', 'table', '../evil'],
    ['injected scheme in type', 'javascript:alert(1)', '1'],
    ['slash in id', 'table', '1/2'],
    ['id over 64 chars', 'table', 'a'.repeat(65)],
  ])('rejects %s', (_label, type, id) => {
    expect(buildDeepLink('gomingle', type, id)).toBeNull()
  })

  it('returns null when the scheme is not configured', () => {
    expect(buildDeepLink('', 'table', '123')).toBeNull()
  })
})

describe('store URLs', () => {
  it('builds an App Store URL from a numeric id', () => {
    expect(buildIosStoreUrl('1234567890')).toBe('https://apps.apple.com/app/id1234567890')
  })

  it('rejects a non-numeric or unset App Store id', () => {
    expect(buildIosStoreUrl('')).toBeNull()
    expect(buildIosStoreUrl('id1234567890')).toBeNull()
  })

  it('builds a Play Store URL from a package name', () => {
    expect(buildAndroidStoreUrl('com.gomingle.app')).toBe(
      'https://play.google.com/store/apps/details?id=com.gomingle.app',
    )
  })

  it('rejects a malformed or unset package name', () => {
    expect(buildAndroidStoreUrl('')).toBeNull()
    expect(buildAndroidStoreUrl('gomingle')).toBeNull()
  })
})

describe('resolveFallbackUrl', () => {
  it('sends iOS to the App Store', () => {
    expect(resolveFallbackUrl('ios', CONFIG)).toBe('https://apps.apple.com/app/id1234567890')
  })

  it('sends Android to the Play Store', () => {
    expect(resolveFallbackUrl('android', CONFIG)).toBe(
      'https://play.google.com/store/apps/details?id=com.gomingle.app',
    )
  })

  it('sends desktop to the web fallback', () => {
    expect(resolveFallbackUrl('desktop', CONFIG)).toBe('https://gomingle.com')
  })

  it('degrades to the web fallback when a store id is unconfigured', () => {
    const unconfigured = { ...CONFIG, iosAppId: '', androidPackageName: '' }
    expect(resolveFallbackUrl('ios', unconfigured)).toBe('https://gomingle.com')
    expect(resolveFallbackUrl('android', unconfigured)).toBe('https://gomingle.com')
  })
})

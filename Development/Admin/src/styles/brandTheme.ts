import type { ThemeConfig } from 'antd'

/**
 * The Candlelit palette (GM-334): Midnight and Ember from the logo's table,
 * Candle and Mint from the guests around it. The whole app now wears these
 * colours, so the landing screens need no palette of their own.
 */
export const GOMINGLE_BRAND = {
  midnight: '#14102A',
  booth: '#221C40',
  ember: '#FF5A44',
  emberDeep: '#D63A25',
  candle: '#FFB547',
  mint: '#3FD6B4',
  brass: '#D98A12',
  sage: '#13A386',
  linen: '#F7F5FC',
  ink: '#1A1530',
} as const

/** The landing screens inherit the app theme (light or dark); kept as a hook for screen-only tweaks. */
export const goMingleAuthTheme: ThemeConfig = {}

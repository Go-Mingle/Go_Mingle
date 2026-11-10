import type { ThemeConfig } from 'antd'

/**
 * GoMingle brand palette, sampled from the official logo.
 * Navy is the "Mingle" wordmark and the left half of the star; coral is "Go"
 * and the right half. Used on the landing (auth) screens.
 */
export const GOMINGLE_BRAND = {
  navy: '#1C1730',
  navyDeep: '#120F22',
  coral: '#FF5A44',
  coralDark: '#E8432E',
  coralLight: '#FFF1EE',
} as const

/** Nested antd theme for the landing screens — primary actions turn coral. */
export const goMingleAuthTheme: ThemeConfig = {
  token: {
    colorPrimary: GOMINGLE_BRAND.coral,
    colorPrimaryHover: GOMINGLE_BRAND.coralDark,
    colorPrimaryActive: GOMINGLE_BRAND.coralDark,
    colorLink: GOMINGLE_BRAND.coralDark,
    colorLinkHover: GOMINGLE_BRAND.coral,
  },
  components: {
    Input: { activeBorderColor: GOMINGLE_BRAND.coral, hoverBorderColor: GOMINGLE_BRAND.coral },
  },
}

import { describe, it, expect } from 'vitest'
import { antdTheme, antdDarkTheme } from '../theme'

/** Relative luminance contrast, WCAG 2.x. */
function contrast(a: string, b: string) {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl
  }
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('antdTheme (Candlelit)', () => {
  it('uses Ember as the primary colour and keeps links static on hover', () => {
    expect(antdTheme.token?.colorPrimary).toBe('#D63A25')
    expect(antdTheme.token?.colorLinkHover).toBe(antdTheme.token?.colorLink)
    expect(antdTheme.token?.colorLinkActive).toBe(antdTheme.token?.colorLink)
  })

  it('meets AA contrast for button labels and links in both themes', () => {
    // Light: white label on Ember, links on white.
    expect(contrast('#FFFFFF', antdTheme.token!.colorPrimary!)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(antdTheme.token!.colorLink!, '#FFFFFF')).toBeGreaterThanOrEqual(4.5)
    // Dark: Midnight label on the bright ember, links on the card surface.
    expect(
      contrast(antdDarkTheme.token!.colorTextLightSolid!, antdDarkTheme.token!.colorPrimary!),
    ).toBeGreaterThanOrEqual(4.5)
    expect(
      contrast(antdDarkTheme.token!.colorLink!, antdDarkTheme.token!.colorBgContainer!),
    ).toBeGreaterThanOrEqual(4.5)
  })

  it('sets the interface font to Manrope', () => {
    expect(antdTheme.token?.fontFamily).toContain('Manrope')
  })
})

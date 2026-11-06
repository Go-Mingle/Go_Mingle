import { describe, it, expect } from 'vitest'
import { antdTheme } from '../theme'

describe('antdTheme', () => {
  it('sets the brand teal as the AntD link color so raw <a> tags match the source portal', () => {
    // AntD's default colorLink is blue (#1677ff) and its unlayered global `a`
    // rule beats Tailwind's layered color utilities — so this token is what
    // makes links render teal. Hover/active are kept equal to the base color to
    // match the source's static, inline-styled anchors.
    expect(antdTheme.token?.colorLink).toBe('#0FA79D')
    expect(antdTheme.token?.colorLinkHover).toBe('#0FA79D')
    expect(antdTheme.token?.colorLinkActive).toBe('#0FA79D')
  })

  it('keeps the accent as the primary color', () => {
    expect(antdTheme.token?.colorPrimary).toBe('#0FA79D')
  })
})

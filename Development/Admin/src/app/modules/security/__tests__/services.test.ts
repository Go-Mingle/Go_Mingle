import { describe, expect, it } from 'vitest'
import { describeDevice, groupSecret } from '../services'

describe('describeDevice', () => {
  it('names common browsers and systems', () => {
    expect(
      describeDevice(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36',
      ),
    ).toEqual({ browser: 'Chrome', os: 'macOS', mobile: false })
    expect(
      describeDevice(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
      ),
    ).toEqual({ browser: 'Safari', os: 'iPhone', mobile: true })
    expect(describeDevice('Mozilla/5.0 (Windows NT 10.0) Chrome/131.0 Edg/131.0').browser).toBe(
      'Edge',
    )
    expect(describeDevice('')).toEqual({ browser: 'Browser', os: 'unknown device', mobile: false })
  })
})

describe('groupSecret', () => {
  it('splits the key into groups of four', () => {
    expect(groupSecret('JBSWY3DPEHPK3PXP')).toBe('JBSW Y3DP EHPK 3PXP')
  })
})

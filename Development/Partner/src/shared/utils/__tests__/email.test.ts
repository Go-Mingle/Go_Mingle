import { describe, it, expect } from 'vitest'
import { isValidEmail } from '../email'

describe('isValidEmail', () => {
  it.each(['hira@aurelia.pk', 'first.last@aurelia.co.uk', 'partner+tag@gomingle.com', 'a@b.co'])(
    'accepts %s',
    (value) => {
      expect(isValidEmail(value)).toBe(true)
    },
  )

  it('ignores surrounding whitespace', () => {
    expect(isValidEmail('  hira@aurelia.pk  ')).toBe(true)
  })

  it.each([
    '',
    'not-an-email',
    'no-at-sign.com',
    '@aurelia.pk',
    'hira@',
    'hira@aurelia',
    'hira@@aurelia.pk',
    'hira @aurelia.pk',
    'hira@aurelia..ae',
    '.hira@aurelia.pk',
  ])('rejects %s', (value) => {
    expect(isValidEmail(value)).toBe(false)
  })

  it('stays linear on a long non-matching string', () => {
    // Guards against catastrophic backtracking: the segments exclude '.', so
    // there is no ambiguity for the engine to explore.
    const started = performance.now()
    expect(isValidEmail(`${'a'.repeat(5000)}@`)).toBe(false)
    expect(performance.now() - started).toBeLessThan(1000)
  })
})

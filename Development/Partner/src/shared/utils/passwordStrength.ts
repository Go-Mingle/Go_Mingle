export const STRENGTH_COLORS = [
  'var(--color-error)',
  'var(--color-warning)',
  'var(--color-warning)',
  'var(--color-success)',
]

export const PASSWORD_MIN_LENGTH = 8

const HAS_UPPER = /[A-Z]/
const HAS_DIGIT = /[0-9]/
const HAS_SYMBOL = /[^A-Za-z0-9]/

/** Meter fill only — 0 to 4. Not the accept/reject rule; see {@link meetsPasswordPolicy}. */
export function getStrength(pw: string): number {
  let score = 0
  if (pw.length >= PASSWORD_MIN_LENGTH) score++
  if (HAS_UPPER.test(pw)) score++
  if (HAS_DIGIT.test(pw)) score++
  if (HAS_SYMBOL.test(pw)) score++
  return score
}

/**
 * The enforced rule (J1 BR-06), mirroring the Cognito pool policy: at least 8
 * characters **plus at least one of** uppercase, number, or symbol.
 *
 * The three character classes are an OR, not an AND — `aurelia1` and `aurelia!`
 * are both valid, so a strength score must never be used as the gate. The meter
 * scores `Ab1!` at 3 despite it being too short, which would let through a
 * password the backend rejects with 422.
 */
export function meetsPasswordPolicy(pw: string): boolean {
  if (pw.length < PASSWORD_MIN_LENGTH) return false
  return HAS_UPPER.test(pw) || HAS_DIGIT.test(pw) || HAS_SYMBOL.test(pw)
}

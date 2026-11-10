/**
 * Deliberately linear: the local part and each domain label exclude `.`, so
 * there is no ambiguity for the engine to backtrack over. A permissive shape
 * check is all the client needs — Cognito is the authority on deliverability.
 */
const EMAIL_PATTERN = /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

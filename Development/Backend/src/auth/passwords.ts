import bcrypt from 'bcryptjs'

/** Password policy shared by both portals: 8+ chars, upper, lower, digit, symbol. */
export function meetsPasswordPolicy(password: unknown): password is string {
  return (
    typeof password === 'string' &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  )
}

export function normaliseEmail(email: unknown): string {
  return String(email ?? '').trim().toLowerCase()
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10)
}

export function checkPassword(hash: string | null | undefined, password: unknown): boolean {
  return Boolean(hash) && bcrypt.compareSync(String(password ?? ''), hash as string)
}

export const POLICY_MESSAGE =
  'Password must be at least 8 characters with upper and lower case letters, a number and a symbol.'

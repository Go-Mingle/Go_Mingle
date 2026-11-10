// Strict email validation shared across all email inputs (login, user modals, profile).
// AntD's built-in `type: 'email'` rule is too permissive — it accepts leading/trailing
// hyphens in domains, consecutive dots, single/numeric/over-long TLDs, unicode/emoji and
// injection strings. This validator rejects those while accepting genuinely valid addresses.

const MAX_LOCAL_LENGTH = 64
const MAX_DOMAIN_LENGTH = 255
const MAX_LABEL_LENGTH = 63

const LOCAL_ALLOWED = /^[A-Za-z0-9._%+-]+$/
const LABEL_ALLOWED = /^[A-Za-z0-9-]+$/
const TLD_ALLOWED = /^[A-Za-z]{2,24}$/

// True only if every code unit is ASCII (<= 127) — rejects emoji / unicode.
// Implemented as a scan (not a regex) to avoid control chars in a pattern.
function isAsciiOnly(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) > 127) return false
  }
  return true
}

function hasEdgeOrDoubleDot(part: string): boolean {
  return part.startsWith('.') || part.endsWith('.') || part.includes('..')
}

function isValidLocalPart(local: string): boolean {
  if (!local || local.length > MAX_LOCAL_LENGTH) return false
  if (!LOCAL_ALLOWED.test(local)) return false
  return !hasEdgeOrDoubleDot(local)
}

function isValidDomainLabel(label: string): boolean {
  if (!label || label.length > MAX_LABEL_LENGTH) return false
  if (!LABEL_ALLOWED.test(label)) return false
  return !label.startsWith('-') && !label.endsWith('-')
}

function isValidDomain(domain: string): boolean {
  if (!domain || domain.length > MAX_DOMAIN_LENGTH) return false
  if (hasEdgeOrDoubleDot(domain)) return false
  if (domain.startsWith('-') || domain.endsWith('-')) return false

  const labels = domain.split('.')
  if (labels.length < 2) return false // must have at least one dot (domain + TLD)
  if (!labels.every(isValidDomainLabel)) return false

  // TLD: letters only, 2–24 chars.
  const tld = labels.at(-1) ?? ''
  return TLD_ALLOWED.test(tld)
}

/**
 * Returns true only for a well-formed email address.
 *
 * Rejects: surrounding/internal whitespace, non-ASCII (emoji/unicode), missing or
 * duplicate `@`, empty/over-long parts, disallowed characters, leading/trailing dots,
 * consecutive dots, leading/trailing hyphens in domain labels, missing TLD, and TLDs
 * that are numeric, single-character, or longer than 24 characters.
 */
export function isValidEmail(value = ''): boolean {
  // No surrounding or internal whitespace.
  if (value !== value.trim() || /\s/.test(value)) return false

  // ASCII only — rejects emoji and other unicode.
  if (!isAsciiOnly(value)) return false

  // Exactly one `@`.
  const at = value.indexOf('@')
  if (at < 0 || at !== value.lastIndexOf('@')) return false

  return isValidLocalPart(value.slice(0, at)) && isValidDomain(value.slice(at + 1))
}

/**
 * AntD `Form.Item` rule that validates email format with {@link isValidEmail}.
 * Empty values pass here (pair with a separate `{ required: true }` rule).
 */
export function emailValidatorRule(message: string) {
  return {
    validator: (_: unknown, value: string) =>
      !value || isValidEmail(value) ? Promise.resolve() : Promise.reject(new Error(message)),
  }
}

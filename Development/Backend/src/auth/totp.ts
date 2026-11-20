import crypto from 'node:crypto'

/**
 * Time-based one-time passwords (RFC 6238, the codes authenticator apps show):
 * HMAC-SHA1, 6 digits, 30-second steps. Built on node:crypto, no dependency.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const TOTP_STEP_SECONDS = 30
const DIGITS = 6

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch)
    if (idx < 0) throw new Error('Invalid base32')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

/** A new 160-bit secret, base32 (what the authenticator app stores). */
export const newTotpSecret = () => base32Encode(crypto.randomBytes(20))

/** HOTP (RFC 4226) for one counter value. */
export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(msg).digest()
  const offset = mac[mac.length - 1] & 0x0f
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS
  return String(bin).padStart(DIGITS, '0')
}

export const totpStep = (now = Date.now()) => Math.floor(now / 1000 / TOTP_STEP_SECONDS)

/** The code shown right now. */
export const totp = (secret: string, now = Date.now()) => hotp(secret, totpStep(now))

/**
 * Checks a code against the current step and one step either side (clock
 * drift). Returns the matched step so the caller can refuse a replay of the
 * same code, or null when it doesn't match.
 */
export function verifyTotp(secret: string, code: unknown, now = Date.now(), lastUsedStep = 0): number | null {
  const c = String(code ?? '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return null
  const step = totpStep(now)
  for (const s of [step, step - 1, step + 1]) {
    if (s <= lastUsedStep) continue
    const expected = hotp(secret, s)
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return s
  }
  return null
}

/** The link authenticator apps understand (and QR codes carry). */
export function otpauthUrl(secret: string, account: string, issuer = 'GoMingle Admin'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

// ── Backup codes ───────────────────────────────────────────────────────────

/** Ten one-time backup codes like `7KQ4-M2XD` (no 0/O/1/I to misread). */
export function newBackupCodes(count = 10): string[] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: count }, () => {
    const bytes = crypto.randomBytes(8)
    const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('')
    return `${chars.slice(0, 4)}-${chars.slice(4)}`
  })
}

export const normaliseBackupCode = (code: unknown) =>
  String(code ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

export const hashBackupCode = (code: string) =>
  crypto.createHash('sha256').update(normaliseBackupCode(code)).digest('hex')

// ── Secret at rest ─────────────────────────────────────────────────────────

/**
 * TOTP secrets are stored encrypted (AES-256-GCM) with a key derived from the
 * server secret, so a database leak alone doesn't hand out working codes.
 */
function key(serverSecret: string) {
  return crypto.createHash('sha256').update(`${serverSecret}:admin-totp`).digest()
}

export function sealSecret(plain: string, serverSecret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(serverSecret), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')
}

export function openSecret(sealed: string, serverSecret: string): string | null {
  try {
    const [v, iv, tag, data] = sealed.split('.')
    if (v !== 'v1') return null
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(serverSecret), Buffer.from(iv, 'base64url'))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

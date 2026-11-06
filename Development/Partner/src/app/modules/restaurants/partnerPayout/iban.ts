/** Pakistani IBAN helpers, mirroring the server's check so errors show before saving. */

export function normaliseIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** PK + 2 check digits + 4-letter bank code + 16 digits, with the ISO 13616 mod-97 check. */
export function isValidPkIban(value: string): boolean {
  const iban = normaliseIban(value)
  if (!/^PK\d{2}[A-Z]{4}\d{16}$/.test(iban)) return false
  const digits = (iban.slice(4) + iban.slice(0, 4)).replace(/[A-Z]/g, (c) =>
    String(c.charCodeAt(0) - 55),
  )
  let remainder = 0
  for (const ch of digits) remainder = (remainder * 10 + Number(ch)) % 97
  return remainder === 1
}

/** Groups an IBAN in fours for display while typing: "PK72 HABB 0012 …". */
export function formatIban(value: string): string {
  return normaliseIban(value)
    .replace(/(.{4})/g, '$1 ')
    .trim()
}

/** Date helpers. GoMingle runs on Karachi time (UTC+5, no daylight saving). */

const pad = (n: number) => String(n).padStart(2, '0')

export const nowIso = () => new Date().toISOString()
export const today = () => new Date().toISOString().slice(0, 10)

/** Karachi wall-clock parts. */
export function karachi(date = new Date()) {
  const k = new Date(date.getTime() + 5 * 3_600_000)
  return {
    y: k.getUTCFullYear(),
    m: pad(k.getUTCMonth() + 1),
    d: pad(k.getUTCDate()),
    hh: pad(k.getUTCHours()),
    mm: pad(k.getUTCMinutes()),
  }
}

/** `DD-MM-YYYY HH:MM` in Asia/Karachi, the format partner screens expect. */
export function karachiStamp(date = new Date()): string {
  const k = karachi(date)
  return `${k.d}-${k.m}-${k.y} ${k.hh}:${k.mm}`
}

/** `YYYY-MM-DD HH:mm` in Asia/Karachi (change log). */
export function karachiLogStamp(date = new Date()): string {
  const k = karachi(date)
  return `${k.y}-${k.m}-${k.d} ${k.hh}:${k.mm}`
}

/** `18:30` → `6:30 PM`. */
export function to12h(hhmm: unknown): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm ?? ''))
  if (!m) return String(hhmm ?? '')
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

/** Initials of a name: "Hira Mansoor" → "HM". */
export function initialsOf(name: unknown): string {
  return String(name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

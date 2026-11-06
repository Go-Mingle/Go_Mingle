/**
 * Display helpers for the notification surfaces.
 *
 * Two things here are unusual for this codebase, both deliberately:
 *
 *  - **The client computes the timestamp.** Every other date in the portal arrives
 *    pre-formatted and is rendered verbatim. Relative time needs a parseable instant,
 *    so `createdAt` arrives as a real ISO value and the ladder is ours (BR-11).
 *  - **The absolute form is not `DD-MM-YYYY`.** It is `8 May 2026, 2:14 PM` — the one
 *    place in the Partner Portal that departs from F1 BR-15, per the design.
 */

const MINUTE_MS = 60_000
const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** The ladder's cutover: from here on, an absolute date rather than "N days ago". */
const ABSOLUTE_AFTER_DAYS = 7

/**
 * `8 May 2026, 2:14 PM` in Asia/Karachi.
 *
 * `Intl` rather than a dayjs timezone plugin, following J6B's `formatUploadedAt` —
 * it needs no extra bundle and no global plugin registration. Getting the zone right
 * matters: the prototype card used `dayjs(...).format('D MMM YYYY, h:mm A')`, which
 * renders in the **viewer's** zone and so disagreed with every other date in the
 * portal for anyone outside the Gulf.
 */
const KARACHI_ABSOLUTE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Karachi',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  // `hourCycle: 'h12'`, **not** `hour12: true`.
  //
  // `hour12: true` does not pin the cycle — it lets the locale and the runtime's ICU
  // version choose between `h12` (1–12) and `h11` (0–11). `en-GB` resolves to `h12` on
  // ICU 77 but to `h11` on older builds, and under `h11` midnight renders "0:00 AM" and
  // noon renders "0:00 PM". That is a display bug, not a test detail: the same
  // notification would read differently depending on which Node the bundle was built and
  // run against. Naming the cycle removes the choice.
  hourCycle: 'h12',
})

/**
 * What to render for a notification's age.
 *
 * Returns an i18n **key plus a count**, not a finished string. Module `format.ts`
 * files in this repo do not call `t()` — the caller owns translation, so nothing here
 * bakes in English. `absolute` is the exception: it is a formatted date, not copy.
 */
export type RelativeTime =
  | { kind: 'key'; key: 'justNow' }
  | { kind: 'count'; key: 'minutesAgo' | 'hoursAgo' | 'daysAgo'; count: number }
  | { kind: 'absolute'; absolute: string }

/**
 * The BR-11 ladder, applied identically on both surfaces.
 *
 *   < 1 minute   → Just now
 *   < 1 hour     → N minutes ago
 *   < 24 hours   → N hours ago
 *   1–6 days     → N day(s) ago
 *   ≥ 7 days     → 8 May 2026, 2:14 PM
 *
 * `now` is injectable so the ladder can be tested at each boundary without freezing
 * the clock globally.
 *
 * A negative age — a `createdAt` slightly in the future from clock skew between the
 * server and the browser — reads as "Just now" rather than "-1 minutes ago", which is
 * what the prototype's formatter did.
 */
export function relativeTime(createdAt: string, now: number = Date.now()): RelativeTime {
  const parsed = new Date(createdAt)
  const time = parsed.getTime()

  // An unparseable timestamp falls back to the raw value rather than "Invalid Date":
  // if the backend ever sends an unexpected shape, the row should show it.
  if (Number.isNaN(time)) return { kind: 'absolute', absolute: createdAt }

  const age = now - time
  if (age < MINUTE_MS) return { kind: 'key', key: 'justNow' }

  if (age < HOUR_MS) {
    return { kind: 'count', key: 'minutesAgo', count: Math.floor(age / MINUTE_MS) }
  }
  if (age < DAY_MS) {
    return { kind: 'count', key: 'hoursAgo', count: Math.floor(age / HOUR_MS) }
  }

  const days = Math.floor(age / DAY_MS)
  if (days < ABSOLUTE_AFTER_DAYS) {
    return { kind: 'count', key: 'daysAgo', count: days }
  }

  return { kind: 'absolute', absolute: formatAbsolute(parsed) }
}

/**
 * `8 May 2026, 2:14 PM`.
 *
 * `en-GB` with `hour12` gives "8 May 2026, 2:14 pm" — the meridiem is upper-cased to
 * match the design and the rest of the portal's `h:mm A` convention.
 */
export function formatAbsolute(date: Date): string {
  return KARACHI_ABSOLUTE.format(date).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
}

/**
 * Turns a stored `deepLink` into a path this app can actually navigate to.
 *
 * The producer writes `/restaurant-profile/interest-tables/{itId}` (optionally with
 * `?tab=bookings`), but **this app has no `/restaurant-profile` route**: the
 * interest-table detail lives at `/interest-tables/:id`. Navigating the stored value
 * verbatim lands on the SPA's catch-all, so every deep-link would look broken.
 *
 * So the prefix is stripped and the rest is kept as-is, query string included. Both
 * shapes are accepted, which means this keeps working unchanged if the producers are
 * corrected later — and it keeps working for rows already written if they are not.
 *
 * Returns `null` for an absent link, and for anything that is not a path we recognise
 * as belonging to this app. A null result is not an error: BR-10 says such a row still
 * marks itself read, it just navigates nowhere.
 */
export function resolveDeepLink(deepLink: string | null | undefined): string | null {
  const raw = deepLink?.trim()
  if (!raw) return null

  // Path only, by contract. Anything absolute is not ours to route.
  //
  // The `//` check is not redundant with the `/` one: a protocol-relative URL like
  // `//evil.example.com/x` also starts with a slash, and handing that to `navigate()`
  // leaves the app entirely. Since these paths come from the database rather than from
  // our own code, that would be an open redirect.
  if (!raw.startsWith('/') || raw.startsWith('//')) return null

  const withoutPrefix = raw.startsWith('/restaurant-profile/')
    ? raw.slice('/restaurant-profile'.length)
    : raw

  // Guard against a prefix strip that leaves nothing useful behind.
  return withoutPrefix.startsWith('/') && withoutPrefix.length > 1 ? withoutPrefix : null
}

/**
 * Whether a date is outside the range the list endpoint will accept.
 *
 * Two rules, both of them the API's:
 *
 *  - **A future date is refused** with `ERR_DATE_RANGE_INVALID`, so the picker must not
 *    offer one — otherwise the partner selects a date and gets a 400 for it.
 *  - **Anything before the 90-day window** is silently clamped rather than rejected, which
 *    is worse than an error: a range from last year returns nothing and reads as a bug.
 *    Disabling those dates means the question never arises.
 *
 * Compared on calendar days in Asia/Karachi. Extracted from the picker so it can be tested
 * directly — asserting AntD's disabled-cell markup is brittle and tests the library
 * rather than the rule.
 */
export function isDateOutsideWindow(
  date: Date,
  windowDays: number,
  now: number = Date.now(),
): boolean {
  const dayMs = 86_400_000
  // Midnight-to-midnight in Karachi, so a date is judged by its day and not its time.
  const dayOf = (ms: number) => Math.floor((ms + 5 * 3_600_000) / dayMs)

  const target = dayOf(date.getTime())
  const today = dayOf(now)

  return target > today || target < today - windowDays
}

/**
 * The badge's display value: `null` when there is nothing to show.
 *
 * Null rather than `'0'` because the badge is **removed entirely** at zero (BR-06) —
 * the bell shows as an outline, not as a bell with a nought on it.
 */
export function unreadBadgeLabel(count: number, cap: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null
  return count > cap ? `${String(cap)}+` : String(count)
}

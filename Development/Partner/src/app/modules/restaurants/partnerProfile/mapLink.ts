/**
 * Reads a map position out of what a partner can paste: a Google Maps link or
 * a "latitude, longitude" pair. Used when the interactive map is not available
 * (no Maps key configured, or the script failed to load).
 */

export type MapLinkResult =
  | { ok: true; latitude: number; longitude: number; precise: boolean }
  | { ok: false; reason: 'empty' | 'shortLink' | 'unreadable' | 'outOfRange' }

const NUM = '(-?\\d{1,3}(?:\\.\\d+)?)'
const PAIR = new RegExp(`^\\s*${NUM}\\s*,\\s*${NUM}\\s*$`)
/** The dropped pin of a place link: …!3d24.92!4d67.09… */
const PLACE_PIN = new RegExp(`!3d${NUM}!4d${NUM}`)
/** An explicit query point: ?q=24.92,67.09 (also ll=, query=, destination=). */
const QUERY_POINT = new RegExp(`[?&](?:q|ll|query|destination)=${NUM}(?:,|%2C)${NUM}`, 'i')
/** The map's view centre and zoom: /@24.87,67.04,13z */
const VIEW_CENTRE = new RegExp(`@${NUM},${NUM}(?:,(\\d+(?:\\.\\d+)?)z)?`)

/** Zoom at or above which a view centre is close enough to be the place itself. */
const PRECISE_ZOOM = 17

function result(lat: number, lng: number, precise: boolean): MapLinkResult {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return { ok: false, reason: 'outOfRange' }
  }
  return { ok: true, latitude: lat, longitude: lng, precise }
}

export function parseMapLink(raw: string): MapLinkResult {
  const text = raw.trim()
  if (!text) return { ok: false, reason: 'empty' }

  const pair = text.match(PAIR)
  if (pair) return result(Number(pair[1]), Number(pair[2]), true)

  // maps.app.goo.gl / goo.gl/maps links only redirect; the coordinates are not in them.
  if (/(?:maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(text)) return { ok: false, reason: 'shortLink' }

  const pin = text.match(PLACE_PIN)
  if (pin) return result(Number(pin[1]), Number(pin[2]), true)

  const query = text.match(QUERY_POINT)
  if (query) return result(Number(query[1]), Number(query[2]), true)

  const view = text.match(VIEW_CENTRE)
  if (view) {
    const zoom = view[3] ? Number(view[3]) : 0
    return result(Number(view[1]), Number(view[2]), zoom >= PRECISE_ZOOM)
  }

  return { ok: false, reason: 'unreadable' }
}

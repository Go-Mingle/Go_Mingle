import { HttpResponse } from 'msw'

/**
 * The stand-in CDN the media, review and menu fixtures hand out URLs for.
 *
 * Every fixture photo carries an absolute `https://cdn.mock.local/…` URL, which
 * goes straight into an `<img src>`. Without a handler for that origin MSW
 * passes the request through and the browser attempts a real DNS lookup, so the
 * whole gallery renders as broken images — the seeded photos included, which is
 * what made a *working* upload look like a failed one.
 *
 * Two kinds of object live here:
 *
 *   - **Uploaded bytes.** `receiveMockUpload` keeps what was PUT to the upload
 *     target and the commit parks it under the URL it just minted, so the photo
 *     that comes back is the file the partner actually picked.
 *   - **Everything else** — seeded photos, review thumbnails, video posters —
 *     has no bytes behind it and gets a generated placeholder instead.
 *
 * In-memory only, and cleared by `resetMockMedia`. A reload re-seeds the
 * fixtures from scratch, exactly as every other mock module does.
 */

export const MOCK_CDN_ORIGIN = 'https://cdn.mock.local'
export const MOCK_STREAM_ORIGIN = 'https://stream.mock.local'

interface StoredObject {
  bytes: ArrayBuffer
  /**
   * The type declared at step 1, not the URL's extension.
   *
   * The fixtures mint every photo URL as `…/{mediaId}.jpg` regardless of what
   * was uploaded, so a PNG is served from a `.jpg` path. Browsers go by this
   * header rather than the extension, so it renders correctly either way.
   */
  contentType: string
}

const objects = new Map<string, StoredObject>()

/** Keyed by path, so a stored object is found however the URL was built. */
function pathOf(url: string): string {
  return new URL(url).pathname
}

export function putMockCdnObject(url: string, bytes: ArrayBuffer, contentType: string): void {
  objects.set(pathOf(url), { bytes, contentType })
}

export function clearMockCdnObjects(): void {
  objects.clear()
}

/** Stable per path, so a tile keeps its colour across re-renders and refetches. */
function hueOf(path: string): number {
  let hash = 0
  for (let index = 0; index < path.length; index += 1) {
    hash = (hash * 31 + path.charCodeAt(index)) % 360
  }
  return hash
}

/**
 * A generic photo glyph for anything with no bytes behind it.
 *
 * SVG rather than a base64 PNG so it stays readable and costs nothing to
 * change; `<img>` renders it the same way.
 */
function placeholderSvg(path: string): string {
  const hue = hueOf(path)
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">',
    `<rect width="400" height="300" fill="hsl(${String(hue)} 42% 88%)"/>`,
    `<g fill="none" stroke="hsl(${String(hue)} 38% 52%)" stroke-width="8" stroke-linejoin="round">`,
    '<rect x="118" y="92" width="164" height="122" rx="12"/>',
    '<path d="M130 196l46-48 33 33 27-25 34 40"/>',
    '</g>',
    `<circle cx="245" cy="128" r="12" fill="hsl(${String(hue)} 38% 52%)"/>`,
    '</svg>',
  ].join('')
}

/** Serves the uploaded bytes when we have them, a placeholder when we do not. */
export function serveMockCdnObject(url: string): Response {
  const stored = objects.get(pathOf(url))

  if (stored) {
    return new HttpResponse(stored.bytes, {
      headers: {
        'Content-Type': stored.contentType,
        'Content-Length': String(stored.bytes.byteLength),
        // Re-requested freely: the bytes only live as long as the tab does.
        'Cache-Control': 'no-store',
      },
    })
  }

  return new HttpResponse(placeholderSvg(pathOf(url)), {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
  })
}

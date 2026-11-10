import { http } from 'msw'
import { MOCK_CDN_ORIGIN, MOCK_STREAM_ORIGIN, serveMockCdnObject } from '../data/mockCdn'

/**
 * The asset origins the fixtures put into `<img src>` attributes.
 *
 * Not an API surface — these stand in for CloudFront and Cloudflare Stream, and
 * they exist because an unhandled origin is not a no-op: MSW passes it through,
 * the browser does a real DNS lookup for a host that does not exist, and every
 * photo in the app renders broken. That failure reads as "the upload didn't
 * work" even when all three upload steps returned cleanly.
 *
 * Registered with the versioned partner handlers only. Under
 * `VITE_ENABLE_MOCKS=legacy` the media endpoints reach the real backend and
 * hand back real CDN URLs, which must not be intercepted.
 */
export const mockCdnHandlers = [
  http.get(`${MOCK_CDN_ORIGIN}/*`, ({ request }) => serveMockCdnObject(request.url)),
  http.get(`${MOCK_STREAM_ORIGIN}/*`, ({ request }) => serveMockCdnObject(request.url)),
]

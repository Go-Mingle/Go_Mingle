import { http, HttpResponse } from 'msw'

const BASE = '/api/v1/uploads'

// Content-type → extension, mirroring the backend's CONTENT_TYPE_EXT
// (uploads.constants.ts). The extension comes from the content type, never from
// the caller-supplied fileName — the real service ignores fileName entirely when
// building the key.
const CONTENT_TYPE_EXT: Readonly<Record<string, string>> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// Purpose → key prefix, mirroring the backend's PURPOSE_CONFIG. A TOPIC_GRAPHIC
// key MUST sit under `topics/`: the backend validates it against
// TOPIC_GRAPHIC_KEY_PATTERN (/^topics\/…/), which rejects a `covers/` prefix
// outright (MET-805). This mock used to mint `covers/…` for every purpose, so a
// key the real API answers with 400 sailed through the suite.
const PURPOSE_PREFIX: Readonly<Record<string, string>> = {
  TOPIC_GRAPHIC: 'topics/',
  INTEREST_TABLE_COVER: 'covers/',
}

// The real service builds `${prefix}${randomUUID()}.${ext}` — a DISTINCT key per
// call. This mock previously derived the key from purpose + extension alone, so
// every upload in a session resolved to the SAME key, and therefore to the same
// graphic URL for every entity. That made a graphic cross-wire between two
// topics (MET-1285) impossible to reproduce in a test: the newly created topic
// and the one edited afterwards genuinely shared one key, so the suite agreed
// with the bug. Counting up keeps each key unique while staying deterministic
// enough to assert on; the shape stays UUID-like so it satisfies the backend's
// key pattern.
let uploadSeq = 0
const nextObjectId = () => `00000000-0000-4000-8000-${String(++uploadSeq).padStart(12, '0')}`

// Signed-URL provider (spec: POST /api/v1/uploads/signed-url). Returns a mock
// pre-signed URL plus the storage `key` the client persists as coverImageKey /
// graphicKey. The client must then PUT the bytes to that URL — the backend does
// not ingest them — so the bucket PUT is mocked below too (MET-963).
export const uploadsHandlers = [
  http.post(`${BASE}/signed-url`, async ({ request }) => {
    const body = (await request.json()) as {
      fileName?: string
      contentType?: string
      purpose?: string
    }
    const prefix = PURPOSE_PREFIX[body.purpose ?? ''] ?? 'covers/'
    const ext = CONTENT_TYPE_EXT[body.contentType ?? ''] ?? 'png'
    const key = `${prefix}${nextObjectId()}.${ext}`
    return HttpResponse.json({
      success: true,
      data: {
        uploadUrl: `https://mock-bucket.local/${key}?signature=mock`,
        key,
      },
    })
  }),

  // The pre-signed bucket PUT. Matched by RegExp rather than a `*` path pattern,
  // which does not match across segments under this MSW version and would let
  // the request escape to the network. Real S3 signs the Content-Type header, so
  // a request arriving without one is refused here too rather than passing an
  // upload the real bucket would reject.
  http.put(/^https:\/\/mock-bucket\.local\//, ({ request }) =>
    request.headers.get('content-type')
      ? new HttpResponse(null, { status: 200 })
      : new HttpResponse(null, { status: 403, statusText: 'SignatureDoesNotMatch' }),
  ),
]

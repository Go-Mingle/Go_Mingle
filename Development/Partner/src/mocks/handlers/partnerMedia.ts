import { http, HttpResponse } from 'msw'
import { PARTNER_MEDIA_ENDPOINTS } from '../../app/modules/restaurants/partnerMedia/constants'
import {
  commitMockDocument,
  commitMockPhoto,
  commitMockVideo,
  deleteMockDocument,
  deleteMockPhoto,
  deleteMockVideo,
  listMockDocuments,
  mockDownloadUrl,
  mockGalleryResponse,
  mockUploadTarget,
  MOCK_UPLOAD_ORIGIN,
  receiveMockUpload,
  setMockCoverPhoto,
} from '../data/partnerMedia'

/**
 * J6B's thirteen client-callable endpoints, plus the direct upload target.
 *
 * Literal sub-paths (`/upload-url`, `/{id}/download-url`, `/{id}/cover`) are
 * registered before the parameterised routes so they are not swallowed as a
 * `mediaId` — the same ordering J6A needed for `/submit` and `/save-draft`.
 */

/**
 * What the upload carried — its length for the commit-time size check, and its
 * first few bytes for the content check (MET-1148). Both stand in for the real
 * server inspecting the stored object.
 *
 * Always raw bytes: the test XHR shim unwraps a multipart envelope before
 * forwarding, because a multipart body cannot be read on this side without
 * hanging. The envelope's shape is asserted in `uploadFile.test.ts` instead.
 */
async function uploadedObject(
  request: Request,
): Promise<{ size: number; leading: number[]; bytes: ArrayBuffer }> {
  const buffer = await request.arrayBuffer().catch(() => new ArrayBuffer(0))
  // Four is the longest signature we check; the rest is kept only so a
  // committed photo has something to serve from the mock CDN.
  return {
    size: buffer.byteLength,
    leading: [...new Uint8Array(buffer.slice(0, 4))],
    bytes: buffer,
  }
}

export const partnerMediaHandlers = [
  // ── Documents ────────────────────────────────────────────────
  http.post(PARTNER_MEDIA_ENDPOINTS.documentUploadUrl, async ({ request }) =>
    mockUploadTarget('document', (await request.json()) as Record<string, unknown>),
  ),

  http.get(PARTNER_MEDIA_ENDPOINTS.documentDownloadUrl(':mediaId'), ({ params }) =>
    mockDownloadUrl(String(params.mediaId)),
  ),

  http.get(PARTNER_MEDIA_ENDPOINTS.documents, ({ request }) => {
    const params = new URL(request.url).searchParams
    return listMockDocuments({
      sortBy: params.get('sortBy'),
      sortOrder: params.get('sortOrder'),
      search: params.get('search'),
    })
  }),

  http.post(PARTNER_MEDIA_ENDPOINTS.documents, async ({ request }) =>
    commitMockDocument((await request.json()) as Record<string, unknown>),
  ),

  http.delete(PARTNER_MEDIA_ENDPOINTS.documentById(':mediaId'), ({ params }) =>
    deleteMockDocument(String(params.mediaId)),
  ),

  // ── Gallery ──────────────────────────────────────────────────
  http.get(PARTNER_MEDIA_ENDPOINTS.media, () => mockGalleryResponse()),

  // ── Photos ───────────────────────────────────────────────────
  http.post(PARTNER_MEDIA_ENDPOINTS.photoUploadUrl, async ({ request }) =>
    mockUploadTarget('photo', (await request.json()) as Record<string, unknown>),
  ),

  http.patch(PARTNER_MEDIA_ENDPOINTS.photoCover(':mediaId'), ({ params }) =>
    setMockCoverPhoto(String(params.mediaId)),
  ),

  http.post(PARTNER_MEDIA_ENDPOINTS.photos, async ({ request }) =>
    commitMockPhoto((await request.json()) as Record<string, unknown>),
  ),

  http.delete(PARTNER_MEDIA_ENDPOINTS.photoById(':mediaId'), ({ params }) =>
    deleteMockPhoto(String(params.mediaId)),
  ),

  // ── Videos ───────────────────────────────────────────────────
  http.post(PARTNER_MEDIA_ENDPOINTS.videoUploadUrl, async ({ request }) =>
    mockUploadTarget('video', (await request.json()) as Record<string, unknown>),
  ),

  http.post(PARTNER_MEDIA_ENDPOINTS.videos, async ({ request }) =>
    commitMockVideo((await request.json()) as Record<string, unknown>),
  ),

  http.delete(PARTNER_MEDIA_ENDPOINTS.videoById(':mediaId'), ({ params }) =>
    deleteMockVideo(String(params.mediaId)),
  ),

  // ── The direct upload target (step 2) ────────────────────────
  /**
   * Stands in for S3 and Cloudflare. Both verbs are accepted so the per-kind
   * strategy runs for real: documents and photos PUT raw bytes, a video POSTs
   * multipart. Recording the upload is what lets commit refuse a reference whose
   * bytes never landed.
   */
  http.put(`${MOCK_UPLOAD_ORIGIN}/:uploadRef`, async ({ params, request }) => {
    const { size, leading, bytes } = await uploadedObject(request)
    return receiveMockUpload(String(params.uploadRef), size, leading, bytes)
  }),

  http.post(`${MOCK_UPLOAD_ORIGIN}/:uploadRef`, async ({ params, request }) => {
    const { size, leading, bytes } = await uploadedObject(request)
    return receiveMockUpload(String(params.uploadRef), size, leading, bytes)
  }),

  /** The presigned GET a document download redirects to. */
  http.get(
    `${MOCK_UPLOAD_ORIGIN}/signed-get/:mediaId`,
    () => new HttpResponse(null, { status: 200 }),
  ),
]

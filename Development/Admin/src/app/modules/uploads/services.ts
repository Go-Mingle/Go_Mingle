import { httpClient } from '../../../shared/api/httpClient'
import { UPLOAD_ENDPOINTS } from './constants'
import type { SignedUrlRequest, SignedUrlResponse } from './types'

export const uploadsService = {
  /**
   * Request a pre-signed upload from the backend and receive the storage `key`
   * to persist against the owning entity. The shared client unwraps the
   * `{ success, data }` envelope, so this resolves to `{ uploadUrl, key }`.
   */
  createSignedUrl: (req: SignedUrlRequest): Promise<SignedUrlResponse> =>
    httpClient.post<SignedUrlResponse>(UPLOAD_ENDPOINTS.signedUrl, req),

  /**
   * PUTs the raw bytes to the pre-signed S3 URL. Without this step the bucket
   * stays empty while the key is still persisted, which is what left interest
   * tables showing a placeholder in the mobile app (MET-963).
   *
   * Two things this must get right:
   * - `contentType` has to be byte-identical to the value sent when the URL was
   *   requested, because the pre-signed signature covers the Content-Type
   *   header. Any difference makes S3 reject the PUT with SignatureDoesNotMatch.
   * - A non-2xx response must throw. S3 reports refusals in the status code, so
   *   an unchecked response lets the caller persist a key for absent bytes.
   *
   * Uses bare `fetch` rather than the shared httpClient on purpose: the URL
   * carries its own credentials in the query string, and adding the portal's
   * Authorization header makes S3 reject the request.
   */
  uploadToSignedUrl: async (uploadUrl: string, file: File, contentType: string): Promise<void> => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': contentType },
    })
    if (!response.ok) {
      throw new Error(`S3 upload failed: ${response.status} ${response.statusText}`)
    }
  },
}

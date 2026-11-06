/** Server-side destinations a signed upload can target. Extend as new upload
 *  surfaces are added (e.g. restaurant covers, avatars). */
export type UploadPurpose = 'INTEREST_TABLE_COVER' | 'TOPIC_GRAPHIC'

export interface SignedUrlRequest {
  fileName: string
  contentType: string
  purpose: UploadPurpose
}

export interface SignedUrlResponse {
  /** Pre-signed S3 URL the client must PUT the raw file bytes to. The backend
   *  does NOT ingest the file — skipping this PUT leaves the bucket empty and
   *  the stored key pointing at nothing (MET-963). */
  uploadUrl: string
  /** Storage key to persist against the owning entity (e.g. `coverImageKey`). */
  key: string
}

/** A file to push through the full two-step upload (signed URL, then S3 PUT). */
export interface UploadFileRequest {
  file: File
  purpose: UploadPurpose
}

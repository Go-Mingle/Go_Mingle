import { useMutation } from '@tanstack/react-query'
import { uploadsService } from '../services'
import type { UploadFileRequest } from '../types'

/**
 * Runs the complete upload the backend expects: request a pre-signed URL, then
 * PUT the bytes to S3. Resolves with the storage `key` only once S3 has accepted
 * the bytes, so a failed upload can never leave a key pointing at an empty
 * object — the failure mode behind MET-963.
 *
 * The two steps are deliberately kept in one mutation. Exposing the signed-url
 * call on its own is what allowed callers to persist a key while silently
 * skipping the PUT.
 */
export function useUploadFileMutation() {
  return useMutation({
    mutationFn: async ({ file, purpose }: UploadFileRequest) => {
      // Resolved once and reused for both steps — the pre-signed signature
      // covers Content-Type, so the two values must not drift apart.
      const contentType = file.type
      const { uploadUrl, key } = await uploadsService.createSignedUrl({
        fileName: file.name,
        contentType,
        purpose,
      })
      await uploadsService.uploadToSignedUrl(uploadUrl, file, contentType)
      return { key }
    },
  })
}

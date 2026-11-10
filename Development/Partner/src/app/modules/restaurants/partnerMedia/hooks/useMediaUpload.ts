import { useCallback, useState } from 'react'
import { uploadFile, UploadError } from '../../../../../shared/api/uploadFile'
import type { UploadStrategy } from '../../../../../shared/api/uploadFile'
import { partnerMediaService } from '../services'
import type { CommitMediaDto, MediaKind, UploadTarget, UploadTargetRequest } from '../types'

/**
 * The three-step upload, as one operation.
 *
 *   1. POST …/upload-url   — count limit enforced here, before any bytes move
 *   2. PUT/POST to the provider — direct, never through our API
 *   3. POST …/{kind}       — commits the entry
 *
 * The filename is sent at step 1 only. Step 3 presents the `uploadRef` alone —
 * the server resolves the name and content type from it, and rejects any other
 * field with a 422 (see {@link CommitMediaDto}).
 *
 * Kept in one place because the steps are only meaningful together: a completed
 * step 2 with no step 3 is an orphaned object the partner cannot see, so nothing
 * should be able to perform them independently.
 */

/** Documents and photos take raw bytes; a video takes Cloudflare multipart. */
const STRATEGY: Record<MediaKind, UploadStrategy> = {
  document: 'put-bytes',
  photo: 'put-bytes',
  video: 'post-multipart',
}

/**
 * A document/photo target carries an S3 `key`; a video target does not.
 *
 * Asserted before sending anything, so a backend change that swapped the
 * protocols would fail loudly here rather than silently corrupting an upload —
 * a multipart body sent to a presigned S3 PUT stores the MIME envelope as if it
 * were the file, which S3 accepts and the user cannot tell apart from success.
 *
 * **Presence only, never shape.** The key is bucket-qualified on the wire since
 * MET-1147, and the bucket segment is whatever `S3_BUCKET_RESTAURANT_*` holds —
 * an env-prefixed deployment returns `gomingle-dev-restaurant-documents/…`. A
 * format check here would pass in one environment and break the upload in
 * another, while proving nothing this one does not.
 */
function assertTargetMatchesKind(target: UploadTarget, kind: MediaKind): void {
  const expectsKey = kind !== 'video'
  const hasKey = typeof target.key === 'string' && target.key.length > 0

  if (expectsKey !== hasKey) {
    throw new UploadError(
      `Upload target for a ${kind} ${hasKey ? 'carried' : 'omitted'} an S3 key unexpectedly`,
      0,
    )
  }
}

const UPLOAD_TARGET: Record<MediaKind, (body: UploadTargetRequest) => Promise<UploadTarget>> = {
  document: partnerMediaService.documentUploadTarget,
  photo: partnerMediaService.photoUploadTarget,
  video: partnerMediaService.videoUploadTarget,
}

export interface OversizeDetails {
  maxBytes: number
  actualBytes: number
}

/**
 * Thrown when the file exceeds the limit step 1 reported.
 *
 * Saves uploading 200 MB only to have the commit reject it — but it is **not**
 * the enforcement: a presigned PUT cannot bind Content-Length, so the server
 * re-verifies at commit by inspecting the stored object.
 */
export class FileTooLargeError extends Error {
  readonly details: OversizeDetails

  constructor(details: OversizeDetails) {
    super('File exceeds the maximum size for this media kind')
    this.name = 'FileTooLargeError'
    this.details = details
  }
}

/**
 * Thrown when the picked file has no bytes at all.
 *
 * The commit inspects the stored object's real signature (MET-1148), and an
 * empty file has none to match — so it now comes back `422 ERR_MEDIA_TYPE`
 * where it once succeeded and created a broken entry. Correct, but the copy is
 * actively misleading: the partner picked a genuine PDF and is told PDFs are
 * not allowed.
 *
 * Caught here instead, before a target is even minted. Mostly reached by
 * picking a file still syncing from OneDrive/Dropbox/iCloud, where "wait for it
 * to finish downloading" is the actual fix and no error naming the *type* can
 * lead anyone to it.
 *
 * This is a **size** check, the same kind as {@link FileTooLargeError} — not
 * content sniffing. The server remains the authority on what the bytes are; we
 * only decline to upload nothing at all.
 */
export class FileEmptyError extends Error {
  constructor() {
    super('File is empty')
    this.name = 'FileEmptyError'
  }
}

export interface UseMediaUploadResult {
  /** Runs all three steps. Resolves with the commit response. */
  run: (file: File) => Promise<unknown>
  uploading: boolean
  /** 0–100 for step 2 only; the two API calls are fast by comparison. */
  progress: number
  reset: () => void
}

type Commit = (body: CommitMediaDto) => Promise<unknown>

export function useMediaUpload(kind: MediaKind, commit: Commit): UseMediaUploadResult {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)

  const reset = useCallback(() => {
    setUploading(false)
    setProgress(0)
  }, [])

  const run = useCallback(
    async (file: File) => {
      setUploading(true)
      setProgress(0)
      try {
        // Before step 1, not after: nothing about an empty file needs the
        // server's answer, so no target is minted and no ref is burned.
        if (file.size === 0) throw new FileEmptyError()

        const target = await UPLOAD_TARGET[kind]({ name: file.name, contentType: file.type })
        assertTargetMatchesKind(target, kind)

        // The authoritative limit, not the documented default — limits are
        // config-driven and can differ per environment.
        if (typeof target.maxBytes === 'number' && file.size > target.maxBytes) {
          throw new FileTooLargeError({ maxBytes: target.maxBytes, actualBytes: file.size })
        }

        await uploadFile({
          uploadUrl: target.uploadUrl,
          file,
          strategy: STRATEGY[kind],
          onProgress: setProgress,
        })

        // The ref alone. The name went with step 1 above; repeating it here is
        // a 422 rather than a harmless duplicate.
        return await commit({ uploadRef: target.uploadRef })
      } finally {
        setUploading(false)
      }
    },
    [kind, commit],
  )

  return { run, uploading, progress, reset }
}

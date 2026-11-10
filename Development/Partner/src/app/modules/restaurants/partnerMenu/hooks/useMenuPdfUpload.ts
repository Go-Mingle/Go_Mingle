import { useCallback, useState } from 'react'
import { uploadFile } from '../../../../../shared/api/uploadFile'
import { FileEmptyError, FileTooLargeError } from '../../partnerMedia/hooks/useMediaUpload'
import { partnerMenuService } from '../services'
import type { MenuPdf } from '../types'

/**
 * The menu-PDF upload, as one operation (BR-03).
 *
 *   1. POST …/menu-pdf/upload-url  — PDF-only; refused here before any bytes move
 *   2. PUT the raw bytes to the presigned URL — direct, never through our API
 *   3. PUT …/menu-pdf { uploadRef }  — commits, replacing any existing PDF
 *
 * Kept together because the steps are only meaningful as a set: a completed
 * step 2 with no step 3 is an orphaned object the partner cannot see.
 *
 * **Not** J6B's `useMediaUpload`, deliberately. That hook is keyed on
 * `MediaKind`, which also drives J6B's accepted types, per-kind error copy and
 * per-kind limits, and it commits with `{ uploadRef, name }` — this endpoint
 * takes the ref alone. Adding a fourth kind there would spread J6D across J6B's
 * domain type to share about fifteen lines. `uploadFile` and
 * {@link FileTooLargeError} are reused instead.
 *
 * There is no preview modal (AC-01.2): the file uploads straight from the picker.
 */

export interface UseMenuPdfUploadResult {
  /** Runs all three steps. Resolves with the committed PDF. */
  run: (file: File) => Promise<MenuPdf>
  uploading: boolean
  /** 0–100 for step 2 only; the two API calls are fast by comparison. */
  progress: number
  reset: () => void
}

type Commit = (uploadRef: string) => Promise<MenuPdf>

export function useMenuPdfUpload(commit: Commit): UseMenuPdfUploadResult {
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
        // Before step 1: an empty file has no signature for the commit to match
        // (MET-1148), and refusing it here keeps the copy honest — "this file is
        // empty" rather than the server's "only a PDF menu is allowed", which is
        // false and unactionable for someone who did pick a PDF.
        if (file.size === 0) throw new FileEmptyError()

        const target = await partnerMenuService.menuPdfUploadTarget(file.name)

        // Checked against the limit step 1 reported, not the documented 10 MB:
        // it is config-driven and can differ per environment. This saves
        // uploading a file the commit would only reject — it is not the
        // enforcement, since a presigned PUT cannot bind Content-Length and the
        // server re-inspects the stored object at step 3.
        if (file.size > target.maxBytes) {
          throw new FileTooLargeError({ maxBytes: target.maxBytes, actualBytes: file.size })
        }

        await uploadFile({
          uploadUrl: target.uploadUrl,
          file,
          // Raw bytes with the file's own Content-Type, and no Authorization
          // header — S3 rejects a presigned request that carries one, because
          // the URL already is the credential.
          strategy: 'put-bytes',
          onProgress: setProgress,
        })

        return await commit(target.uploadRef)
      } finally {
        setUploading(false)
      }
    },
    [commit],
  )

  return { run, uploading, progress, reset }
}

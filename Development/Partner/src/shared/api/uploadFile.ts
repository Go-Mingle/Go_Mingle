/**
 * Direct-to-provider file upload (J6B step 2 of 3).
 *
 * **Deliberately does not use `httpClient`.** That client resolves paths against
 * our API origin and attaches the session Bearer token — both of which are wrong
 * here and the second is actively harmful: S3 rejects a presigned request that
 * also carries an `Authorization` header, because the signature already carries
 * the credential. The upload URL *is* the credential.
 *
 * `XMLHttpRequest` rather than `fetch` because only XHR reports upload progress,
 * and a video may be 200 MB.
 */

/** How the target expects the bytes. Confirmed per-kind with the backend. */
export type UploadStrategy = 'put-bytes' | 'post-multipart'

/**
 * Cloudflare's Direct Creator Upload contract: the multipart field must be named
 * exactly `file`. Not our choice, and not negotiable.
 */
const MULTIPART_FIELD = 'file'

export interface UploadArgs {
  /**
   * Absolute, provider-issued URL. Never prefixed or rewritten.
   *
   * In particular it is never composed from a bucket/host plus the target's
   * `key`: the object key is already inside the presigned signature, so a
   * concatenated URL double-prefixes it and the provider answers 403/404. This
   * is the one thing MET-1147's bucket-qualified `key` could have broken, and
   * the reason nothing here accepts a key at all.
   */
  uploadUrl: string
  file: File
  strategy: UploadStrategy
  /** 0–100, monotonically increasing. Omitted when the browser can't report it. */
  onProgress?: (percent: number) => void
  signal?: AbortSignal
}

/**
 * Distinguishes "the bytes never landed" from "the server refused the commit",
 * so the caller can say *upload failed* rather than blaming validation.
 */
export class UploadError extends Error {
  /** HTTP status from the provider, or 0 for a network/abort failure. */
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'UploadError'
    this.status = status
  }
}

function buildBody(file: File, strategy: UploadStrategy): XMLHttpRequestBodyInit {
  if (strategy === 'put-bytes') return file

  const form = new FormData()
  form.append(MULTIPART_FIELD, file)
  return form
}

/**
 * Sends `file` to a provider-issued upload target.
 *
 * Resolves once the provider has accepted the bytes. It does **not** mean the
 * media exists yet — the entry is only written by the separate commit call.
 */
export function uploadFile({
  uploadUrl,
  file,
  strategy,
  onProgress,
  signal,
}: UploadArgs): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new UploadError('Upload aborted', 0))
      return
    }

    const request = new XMLHttpRequest()
    request.open(strategy === 'put-bytes' ? 'PUT' : 'POST', uploadUrl, true)

    // Only the raw PUT sets a type: for multipart the browser must generate the
    // boundary, and setting the header by hand would omit it and corrupt the body.
    if (strategy === 'put-bytes' && file.type) {
      request.setRequestHeader('Content-Type', file.type)
    }

    if (onProgress) {
      request.upload.onprogress = (event) => {
        // `lengthComputable` is false for a streamed body of unknown size.
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.round((event.loaded / event.total) * 100))
        }
      }
    }

    const abort = () => {
      request.abort()
    }
    signal?.addEventListener('abort', abort)

    const settle = (finish: () => void) => {
      signal?.removeEventListener('abort', abort)
      finish()
    }

    request.onload = () => {
      settle(() => {
        if (request.status >= 200 && request.status < 300) {
          // A provider that reports no progress still ends at 100.
          onProgress?.(100)
          resolve()
          return
        }
        reject(
          new UploadError(`Upload failed with status ${String(request.status)}`, request.status),
        )
      })
    }

    // A CORS preflight rejection also lands here with status 0 and no detail —
    // the browser withholds it — so the message stays deliberately generic.
    request.onerror = () => {
      settle(() => reject(new UploadError('Upload failed before reaching the server', 0)))
    }
    request.onabort = () => {
      settle(() => reject(new UploadError('Upload aborted', 0)))
    }
    request.ontimeout = () => {
      settle(() => reject(new UploadError('Upload timed out', 0)))
    }

    request.send(buildBody(file, strategy))
  })
}

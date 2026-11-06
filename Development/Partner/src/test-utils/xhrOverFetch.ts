import { vi } from 'vitest'

/**
 * A test-only `XMLHttpRequest` that forwards to `fetch`.
 *
 * **Why this exists.** `uploadFile` deliberately uses XHR, because it is the only
 * transport that reports upload progress and a video may be 200 MB. jsdom's XHR
 * cannot carry the bodies that matters for:
 *
 *   - a `File`/`Blob` body is stringified, so the request arrives as the literal
 *     text `"undefined"`;
 *   - a `FormData` body hangs forever behind the MSW interceptor.
 *
 * Both work correctly in a real browser, so this is an environment gap rather
 * than a defect in the code under test. Forwarding to `fetch` — which jsdom and
 * MSW both handle properly for binary and multipart — keeps the assertions
 * honest about method, headers and body, and keeps the MSW round-trip intact so
 * fixtures that require a real upload before commit still behave.
 *
 * Do not "fix" `uploadFile` to use `fetch` on account of this: that would lose
 * upload progress entirely.
 */

export interface RecordedUpload {
  method: string
  url: string
  headers: Record<string, string>
  body: XMLHttpRequestBodyInit | null
}

/** Every request the shim has forwarded, in order. */
export const recordedUploads: RecordedUpload[] = []

type Handler = ((event: ProgressEvent) => void) | null

/** See `forward` for why the multipart envelope cannot survive the round trip. */
async function toCarryablePayload(body: XMLHttpRequestBodyInit | null): Promise<BodyInit | null> {
  if (body instanceof FormData) {
    const part = body.get('file')
    return part instanceof Blob ? new Uint8Array(await part.arrayBuffer()) : null
  }
  if (body instanceof Blob) return new Uint8Array(await body.arrayBuffer())
  return body as BodyInit | null
}

class XhrOverFetch {
  status = 0
  readyState = 0
  onload: Handler = null
  onerror: Handler = null
  onabort: Handler = null
  ontimeout: Handler = null
  upload = { onprogress: null as Handler }

  private method = 'GET'
  private url = ''
  private readonly headers: Record<string, string> = {}
  private aborted = false

  open(method: string, url: string): void {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string): void {
    this.headers[name] = value
  }

  abort(): void {
    this.aborted = true
    this.onabort?.(new ProgressEvent('abort'))
  }

  send(body?: XMLHttpRequestBodyInit | null): void {
    // Recorded before normalising, so assertions still see the real body the
    // production code built — a File for a PUT, a FormData for multipart.
    recordedUploads.push({
      method: this.method,
      url: this.url,
      headers: { ...this.headers },
      body: body ?? null,
    })

    // Reported before the response so a caller watching progress sees movement,
    // mirroring a real upload rather than jumping straight to completion.
    this.upload.onprogress?.(
      new ProgressEvent('progress', { lengthComputable: true, loaded: 50, total: 100 }),
    )

    void this.forward(body ?? null)
  }

  /**
   * Normalises the body into something this environment can actually carry.
   *
   * Two jsdom/MSW limitations force it, and neither reflects a real browser:
   *
   *   - a `File`/`Blob` body is serialized as the literal string `"undefined"`,
   *     which is how a 2 KB upload arrives as 9 bytes. Read to bytes first.
   *   - a `FormData` body can be *sent*, but any attempt to read it on the MSW
   *     side (`arrayBuffer()` or `formData()`) never settles. So the multipart
   *     envelope is unwrapped and the file's bytes are forwarded on their own.
   *
   * The envelope itself is therefore asserted directly against `recordedUploads`
   * in `uploadFile.test.ts` — that the body is a `FormData`, that its only field
   * is named `file`, and that no `Content-Type` is set. What travels from here is
   * only the payload, so end-to-end flows can still size the object honestly.
   */
  private async forward(body: XMLHttpRequestBodyInit | null): Promise<void> {
    try {
      const response = await fetch(this.url, {
        method: this.method,
        headers: this.headers,
        body: await toCarryablePayload(body),
      })
      if (this.aborted) return
      this.status = response.status
      this.onload?.(new ProgressEvent('load'))
    } catch {
      if (this.aborted) return
      this.status = 0
      this.onerror?.(new ProgressEvent('error'))
    }
  }
}

/**
 * Installs the shim for the current test file and clears the recording.
 * Pair with `vi.unstubAllGlobals()` — but note that also drops the
 * `localStorage` stub `setupTests.ts` installs, so prefer restoring
 * `XMLHttpRequest` on its own.
 */
export function installXhrOverFetch(): void {
  recordedUploads.length = 0
  vi.stubGlobal('XMLHttpRequest', XhrOverFetch)
}

/** The single request a test expects to have been forwarded. */
export function lastUpload(): RecordedUpload {
  const last = recordedUploads.at(-1)
  if (!last) throw new Error('No upload was forwarded')
  return last
}

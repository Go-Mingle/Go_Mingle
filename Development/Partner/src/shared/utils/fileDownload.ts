import type { FileDownload } from '../api/httpClient'

/**
 * Saves a blob the API streamed back, using the filename the server chose.
 *
 * Split out from the request layer so the download can be triggered from a
 * mutation callback — and so tests can assert the request without a jsdom
 * anchor click.
 */
export function saveFileDownload({ blob, filename }: FileDownload): void {
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
  } finally {
    // Always released, even if the click throws in an environment without a
    // real navigator — otherwise the object URL leaks for the page's lifetime.
    URL.revokeObjectURL(url)
  }
}

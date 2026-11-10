/**
 * Magic-byte verification, mirroring what the commit step does since MET-1148.
 *
 * The server no longer trusts the `contentType` declared at `…/upload-url`: at
 * commit it inspects the stored object's real leading bytes, and on a mismatch
 * deletes the object and answers `422 ERR_MEDIA_TYPE`. An empty file has no
 * signature at all, so it fails the same way where it previously succeeded and
 * created a broken entry.
 *
 * Mirrored in the fixtures because a mock that accepts bytes the deployed API
 * rejects is a mock that certifies a client against behaviour that no longer
 * exists — the same drift MET-1147 was about.
 *
 * **This is fixture-only.** The client deliberately does no content sniffing:
 * the server is the authority, and the file picker's extension/MIME filter stays
 * exactly as it was. The one client-side check that does exist is for a
 * zero-length file (`FileEmptyError`), which is a size check, not a signature
 * one — it exists so the partner is told "this file is empty" rather than the
 * server's technically-true but misleading "wrong type".
 */

/**
 * Leading bytes per accepted type.
 *
 * `video/mp4` is deliberately absent: video bytes go to Cloudflare Stream, never
 * to a bucket this API reads, so the commit has nothing to inspect and videos
 * are unaffected by MET-1148.
 */
const SIGNATURE_BY_TYPE: Readonly<Record<string, readonly number[]>> = {
  // "%PDF"
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
  // DOCX is a zip container, so it carries the zip local-file-header magic.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [
    0x50, 0x4b, 0x03, 0x04,
  ],
}

/**
 * The canonical leading bytes for a type, or null when the type is not one the
 * commit verifies.
 *
 * Exported for the test-side file builder, so fixtures and tests cannot disagree
 * about what a valid PDF looks like.
 */
export function signatureFor(contentType: string): readonly number[] | null {
  return SIGNATURE_BY_TYPE[contentType] ?? null
}

/**
 * Whether the stored object's leading bytes match the declared type.
 *
 * An unverified type (`video/mp4`) passes — there is nothing to check. A file
 * with no bytes never passes: that is the zero-byte case MET-1148 introduced.
 */
export function bytesMatchContentType(leading: readonly number[], contentType: string): boolean {
  if (leading.length === 0) return false

  const expected = SIGNATURE_BY_TYPE[contentType]
  if (!expected) return true

  return expected.every((byte, index) => leading[index] === byte)
}

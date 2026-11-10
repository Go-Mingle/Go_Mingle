import { signatureFor } from '../mocks/data/fileSignatures'

/**
 * Builds upload `File`s whose bytes actually look like their declared type.
 *
 * Since MET-1148 the commit inspects the stored object's leading bytes, and the
 * fixtures mirror that. A file of zero-filled bytes — which is what every test
 * used to build — is no longer a valid PDF, so the happy paths have to upload
 * something that genuinely carries the signature. Sharing
 * {@link signatureFor} with the fixtures is what stops the two sides from
 * disagreeing about what a valid PDF looks like.
 *
 * The signature is real; the remaining bytes are filler. That is enough for both
 * the mock's check and the size arithmetic, and no test needs a valid document
 * beyond its first four bytes.
 */

/**
 * Real signature for `type`, padded with zeroes to exactly `size` bytes.
 *
 * Backed by an explicit `ArrayBuffer` rather than `new Uint8Array(size)`: the
 * latter widens to `Uint8Array<ArrayBufferLike>`, which `BlobPart` rejects
 * because it admits `SharedArrayBuffer`.
 */
function signedBytes(type: string, size: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(size))
  const signature = signatureFor(type)
  if (signature) bytes.set(signature.slice(0, size), 0)
  return bytes
}

/**
 * A file that will pass the commit's content check.
 *
 * `size` is the exact byte length, so the fixtures' size arithmetic and the
 * oversize paths keep working unchanged.
 */
export function makeMediaFile(name: string, type: string, size: number): File {
  return new File([signedBytes(type, size)], name, { type })
}

/**
 * A file whose bytes contradict its declared type — the MET-1148 rejection.
 *
 * Declares `type` but carries `actualType`'s signature, which is what a partner
 * renaming `notes.txt` to `licence.pdf` produces.
 */
export function makeMismatchedFile(
  name: string,
  type: string,
  actualType: string,
  size = 2048,
): File {
  return new File([signedBytes(actualType, size)], name, { type })
}

/**
 * A zero-byte file, as produced by picking one still syncing from cloud storage.
 *
 * Refused client-side before any target is minted (`FileEmptyError`), so this
 * never reaches the fixtures in practice — but it is the input that proves it.
 */
export function makeEmptyFile(name: string, type: string): File {
  return new File([], name, { type })
}

/**
 * Claims a size without allocating it, for the oversize path only.
 *
 * That path is refused client-side before anything is sent, so the bytes behind
 * the claim are never read — but the signature is still real, so the file is
 * only ever rejected for its size.
 */
export function makeOversizeMediaFile(name: string, type: string, size: number): File {
  const file = makeMediaFile(name, type, 8)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

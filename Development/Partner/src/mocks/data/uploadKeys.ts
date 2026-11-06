/**
 * Bucket-qualified upload keys — the wire shape MET-1147 settled on.
 *
 * The `key` echoed by the three partner upload-target endpoints is prefixed with
 * the bucket the object lives in:
 *
 *   before → restaurants/{restaurantId}/documents/{uuid}.pdf
 *   after  → restaurant-documents/restaurants/{restaurantId}/documents/{uuid}.pdf
 *
 * The stored S3 object key, the staging record and the persisted `media[].key` /
 * `menu_key` all keep the **bare** `restaurants/{id}/…` form — qualifying those
 * would nest every object under a folder named after its own bucket and break
 * each signed download. The prefix therefore exists on the wire only, and this
 * is the producer side of it.
 *
 * Mirrored in the fixtures because a mock that still emits the old bare key is a
 * mock that disagrees with the deployed API. That drift is exactly how a client
 * sending `{ uploadRef, name }` passed this whole suite and then 422'd against
 * the live commit endpoint.
 *
 * **Nothing in `src/app` parses this.** The key is an echo for correlation and
 * debugging: the bytes go to `uploadUrl` and the commit carries `uploadRef`. The
 * bucket segment is not even guaranteed to read literally `restaurant-documents`
 * — it is whatever `S3_BUCKET_RESTAURANT_*` holds, so an env-prefixed deployment
 * (`gomingle-dev-restaurant-documents`) is equally valid. No production code may
 * assert on its shape. The only tests that may are the fixture-contract cases in
 * each module's `services.test.ts`, which exist precisely to keep these mocks
 * from drifting back to the pre-MET-1147 form.
 */

/** Which of F1's four buckets each keyed upload kind lands in. */
const BUCKET = {
  document: 'restaurant-documents',
  photo: 'restaurant-multimedia',
  menu: 'restaurant-multimedia',
} as const

/**
 * The kinds that address an S3 object.
 *
 * A video is absent on purpose: it has no S3 object and therefore no key, which
 * is the client's discriminator for which upload protocol the target expects.
 */
export type KeyedUploadKind = keyof typeof BUCKET

/** The folder under `restaurants/{id}/`, per kind. */
const FOLDER: Record<KeyedUploadKind, string> = {
  document: 'documents',
  photo: 'photos',
  menu: 'menu',
}

/**
 * Stands in for the id the real service reads off the access token. No partner
 * route carries a restaurant id (F1 BR-04), so the fixtures pick one and hold it
 * stable.
 */
export const MOCK_KEY_RESTAURANT_ID = 'rest-1'

/** `.pdf` from `Trade Licence.pdf`; empty for a name with no extension. */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

/**
 * The wire `key` for an issued upload target.
 *
 * `objectId` stands in for the backend's uuid; the extension is carried over
 * from the picked filename, as the real service does from the content type.
 */
export function bucketQualifiedKey(
  kind: KeyedUploadKind,
  objectId: string,
  fileName: string,
): string {
  const object = `${objectId}${extensionOf(fileName)}`
  return `${BUCKET[kind]}/restaurants/${MOCK_KEY_RESTAURANT_ID}/${FOLDER[kind]}/${object}`
}

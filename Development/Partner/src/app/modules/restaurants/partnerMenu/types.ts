/**
 * The single optional menu PDF.
 *
 * Both fields are null when nothing is uploaded — that absence *is* the empty
 * state, not an error.
 *
 * `name` is derived server-side from the object key, so it comes back
 * **slugified**: `My Menu (Final).pdf` reads as `my-menu-final.pdf`. We show it
 * verbatim rather than remembering what the partner picked, so the name never
 * changes between the upload and a refresh.
 */
export interface MenuPdf {
  /**
   * A plain **public** CloudFront URL (CR-39) — no signing, no expiry, no auth
   * header. Safe to open or download directly, unlike J6B's private documents.
   */
  menuUrl: string | null
  name: string | null
}

/**
 * Step 1 of the PDF upload.
 *
 * `maxBytes` is the authoritative limit for this environment; the documented
 * 10 MB is only the default, since the limit is config-driven.
 */
export interface MenuPdfUploadTarget {
  /**
   * The complete presigned target. The bytes go here **verbatim** — the object
   * key is already inside the signature, so composing this URL from a host and
   * `key` would double-prefix it and 403.
   */
  uploadUrl: string
  uploadRef: string
  maxBytes: number
  /**
   * Opaque, and unread. Bucket-qualified on the wire since MET-1147, the same as
   * J6B's document and photo targets — see that module's `UploadTarget.key` for
   * why nothing may parse it.
   */
  key?: string
  expiresInSeconds?: number
}

/**
 * One course section of a combo, in the CR-37 grouped shape.
 *
 * `choose` is the "choice of N" count and may never exceed `options.length` —
 * diners cannot be asked to pick more items than the section offers.
 */
export interface ComboCourse {
  /** The section name, e.g. "Main Course". */
  course: string
  choose: number
  /** The item names offered in this section. */
  options: string[]
}

/** A prix-fixe combo as the list returns it. The key is `comboId`, not `id`. */
export interface MenuOption {
  comboId: string
  name: string
  /**
   * PKR, `numeric(10,2)`. **0 is valid** — a complimentary combo — so this must
   * never be read with a truthiness check.
   */
  pricePkr: number
  /**
   * Hidden combos stay in the list and are badged, never filtered out. The flag
   * withdraws the combo from the admin's future interest-table picker (CR-49);
   * it does not hide it from diners on tables it is already attached to.
   */
  isHidden: boolean
  courses: ComboCourse[]
}

/**
 * The create/edit body. Identical for POST and PATCH: **PATCH is a full
 * replace** of name, price and every section, so the complete `courses` list
 * goes every time — an omitted one would mean "the partner deleted them all".
 */
export interface ComboDraft {
  name: string
  pricePkr: number
  courses: ComboCourse[]
}

/**
 * The visibility response.
 *
 * Note the deliberate asymmetry, named in the spec: the **request** key is
 * `hidden`, the **response** key is `isHidden`.
 */
export interface VisibilityResponse {
  comboId: string
  isHidden: boolean
}

export interface DeletedResponse {
  comboId: string
  deleted: boolean
}

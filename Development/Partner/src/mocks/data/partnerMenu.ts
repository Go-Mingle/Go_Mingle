import { HttpResponse } from 'msw'
import { errorResponse, mockProfile } from './partnerRestaurantProfile'
import { bytesMatchContentType, signatureFor } from './fileSignatures'
import { bucketQualifiedKey } from './uploadKeys'
import { MOCK_CDN_ORIGIN, putMockCdnObject } from './mockCdn'
import type {
  ComboCourse,
  MenuOption,
  MenuPdf,
} from '../../app/modules/restaurants/partnerMenu/types'

/**
 * J6D menu fixtures — the restaurant menu PDF and the prix-fixe combos.
 *
 * Mirrors the real strictness rather than the happy path, because the awkward
 * branches are the ones worth catching: every write is refused while PENDING, a
 * non-PDF is rejected at step 1 before any bytes move, the commit re-checks the
 * stored object's size, deleting a PDF that is not there is a 404, and a combo
 * held by an upcoming interest table cannot be deleted at all.
 *
 * `markComboInUse` / `releaseCombo` exist because the delete guard is only worth
 * having if it can actually be exercised — including the "deletable once the
 * tables end" case (AC-05.3).
 */

const READ_ONLY_MESSAGE = "Your application is under review and can't be edited right now."

/** Config-driven in production; this stands in for `MEDIA_DOC_MAX_BYTES`. */
export const MOCK_MENU_PDF_MAX_BYTES = 10 * 1024 * 1024
export const MOCK_MENU_UPLOAD_ORIGIN = 'https://menu-upload.mock.local'
const CDN = 'https://cdn.gomingle.com/restaurant-multimedia'

interface StagedMenuPdf {
  uploadRef: string
  name: string
  contentType: string
  /** Set once the bytes are PUT, so commit can require a real upload. */
  received: boolean
  size: number
  /** The stored object's leading bytes, inspected at commit (MET-1148). */
  leading: number[]
  /** The uploaded file, served from the CDN once committed. */
  bytes?: ArrayBuffer
}

function seedCourses(): ComboCourse[] {
  return [
    {
      course: 'Main Course',
      choose: 1,
      options: ['Pasta Aglio e Olio', 'Chicken Biryani', 'Lamb Tikka'],
    },
    { course: 'Desserts', choose: 1, options: ['Kunafa', 'Baklava', 'Chocolate Lava Cake'] },
  ]
}

function seedOptions(): MenuOption[] {
  // Oldest first, as the endpoint returns them.
  return [
    {
      comboId: 'c1',
      name: 'Signature Levantine',
      pricePkr: 180,
      isHidden: false,
      courses: seedCourses(),
    },
    {
      comboId: 'c2',
      name: 'Seafood Set',
      pricePkr: 195,
      isHidden: true,
      courses: [
        { course: 'Main Course', choose: 1, options: ['Grilled Hammour', 'Prawn Machboos'] },
      ],
    },
  ]
}

let menuPdf: MenuPdf = { menuUrl: null, name: null }
let options: MenuOption[] = seedOptions()
let staged: StagedMenuPdf[] = []
/** Combos held by an upcoming interest table — the delete guard's input. */
let inUse = new Map<string, number>()
let idCounter = 0

export function resetMockMenu(): void {
  menuPdf = { menuUrl: null, name: null }
  options = seedOptions()
  staged = []
  inUse = new Map()
  idCounter = 0
}

/** Seeds an uploaded PDF, for the "already has one" and replace cases. */
export function setMockMenuPdf(name = 'signature-menu.pdf'): void {
  menuPdf = { menuUrl: `${CDN}/menu/${name}`, name }
}

/**
 * Attaches a combo to N upcoming interest tables, so `DELETE` refuses it.
 *
 * The real join lives in J10B; this stands in for it, since the partner client
 * only ever sees the resulting 409.
 */
export function markComboInUse(comboId: string, upcomingTables = 2): void {
  inUse.set(comboId, upcomingTables)
}

/** Those tables completed or cancelled — the combo becomes deletable (AC-05.3). */
export function releaseCombo(comboId: string): void {
  inUse.delete(comboId)
}

export function mockMenuPdfState(): MenuPdf {
  return { ...menuPdf }
}

export function mockMenuOption(comboId: string): MenuOption | undefined {
  const found = options.find((option) => option.comboId === comboId)
  return found ? { ...found } : undefined
}

export function mockMenuOptionCount(): number {
  return options.length
}

function readOnly(): Response | null {
  return mockProfile.status === 'PENDING'
    ? errorResponse('ERR_PROFILE_READ_ONLY', READ_ONLY_MESSAGE, 409, { status: 'PENDING' })
    : null
}

// ── The menu PDF ───────────────────────────────────────────────
export function getMockMenuPdf(): Response {
  return HttpResponse.json({ success: true, data: menuPdf })
}

export function mockMenuPdfUploadTarget(body: Record<string, unknown>): Response {
  const refused = readOnly()
  if (refused) return refused

  // PDF only, refused before any upload target is issued (BR-03).
  if (body.contentType !== 'application/pdf' || typeof body.name !== 'string' || !body.name) {
    return errorResponse('ERR_VALIDATION', 'Only a PDF menu is allowed.', 422)
  }

  idCounter += 1
  const uploadRef = `mu-${String(idCounter)}`
  staged.push({
    uploadRef,
    name: body.name,
    contentType: 'application/pdf',
    received: false,
    size: 0,
    leading: [],
  })

  return HttpResponse.json({
    success: true,
    data: {
      uploadUrl: `${MOCK_MENU_UPLOAD_ORIGIN}/${uploadRef}`,
      // Bucket-qualified (MET-1147), and always `.pdf`: the backend names the
      // object from the content type, not from the picked filename — which is
      // also why the committed `name` comes back slugified rather than verbatim.
      key: bucketQualifiedKey('menu', uploadRef, 'menu.pdf'),
      uploadRef,
      maxBytes: MOCK_MENU_PDF_MAX_BYTES,
      expiresInSeconds: 900,
    },
  })
}

/**
 * Step 2 — the presigned PUT. Records the real byte size and signature.
 *
 * Stored, not judged: a presigned PUT can enforce neither the length nor the
 * content, which is exactly why the commit re-inspects both.
 */
export function receiveMockMenuPdf(
  uploadRef: string,
  size: number,
  leading?: number[],
  bytes?: ArrayBuffer,
): Response {
  const entry = staged.find((item) => item.uploadRef === uploadRef)
  if (!entry) return new HttpResponse(null, { status: 403 })

  entry.received = true
  entry.size = size
  // Omitted means "bytes that match what was declared" — the ordinary upload.
  // Pass `[]` for the zero-byte case, or another signature for a mismatch.
  entry.leading = leading ?? [...(signatureFor(entry.contentType) ?? [0x00])]
  entry.bytes = bytes
  return new HttpResponse(null, { status: 200 })
}

/**
 * Slugified exactly as the backend does, because the client shows this verbatim
 * and a test that used the picked filename would prove nothing.
 */
function slugify(name: string): string {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug || 'menu'}.pdf`
}

export function commitMockMenuPdf(body: Record<string, unknown>): Response {
  const refused = readOnly()
  if (refused) return refused

  const entry = staged.find((item) => item.uploadRef === body.uploadRef)

  /*
   * A spent or unknown ref is a 404, not a 422 (MET-1148) — this is what a
   * *retried* commit sees. The first attempt consumed the ref and a failed
   * verification deleted the object, so there is nothing left to re-check.
   */
  if (!entry) {
    return errorResponse('ERR_NOT_FOUND', 'No upload was found for that reference.', 404)
  }
  if (!entry.received) {
    return errorResponse('ERR_VALIDATION', 'No uploaded file was found for this reference.', 422)
  }

  /*
   * Consumed before verification, exactly as the server does — which is why a
   * failed commit must be recovered by restarting the upload, never retried.
   */
  staged = staged.filter((item) => item.uploadRef !== entry.uploadRef)

  // Re-verified against the stored object: a presigned PUT cannot bind
  // Content-Length, so the client's pre-check is never the enforcement.
  if (entry.size > MOCK_MENU_PDF_MAX_BYTES) {
    return errorResponse('ERR_MEDIA_TOO_LARGE', 'This file is larger than the 10 MB limit.', 413)
  }

  // The stored bytes, not the type declared at step 1. The section-specific copy
  // goes in `details.message`; the top level stays the generic catalogue string.
  if (!bytesMatchContentType(entry.leading, entry.contentType)) {
    return errorResponse(
      'ERR_MEDIA_TYPE',
      "This file type isn't supported for this section.",
      422,
      {
        contentType: entry.contentType,
        message: 'Only a PDF menu is allowed.',
      },
    )
  }

  // Replace-on-upload: one key, no history (BR-02).
  const name = slugify(entry.name)
  // Served from the CDN with the bytes that were uploaded, when there are any.
  const menuUrl = entry.bytes
    ? `${MOCK_CDN_ORIGIN}/menu/${entry.uploadRef}-${name}`
    : `${CDN}/menu/${entry.uploadRef}-${name}`
  if (entry.bytes) putMockCdnObject(menuUrl, entry.bytes, 'application/pdf')
  menuPdf = { menuUrl, name }

  return HttpResponse.json({ success: true, data: menuPdf })
}

export function deleteMockMenuPdf(): Response {
  const refused = readOnly()
  if (refused) return refused

  if (!menuPdf.menuUrl) {
    return errorResponse('ERR_NOT_FOUND', 'No menu PDF to remove.', 404)
  }

  // Clears the reference; the stored file is retained (BR-04).
  menuPdf = { menuUrl: null, name: null }
  return HttpResponse.json({ success: true, data: { menuUrl: null } })
}

// ── Menu options ───────────────────────────────────────────────
/** Hidden combos included — the partner tab badges them (AC-02.2). */
export function listMockMenuOptions(): Response {
  return HttpResponse.json({ success: true, data: { items: options } })
}

/**
 * The server-side rule mirror. Reports through `details.fields` in the same
 * shape the real backend does, so the client's inline-error mapping is provable
 * rather than asserted.
 */
function validationFailure(body: Record<string, unknown>): Response | null {
  const fields: Record<string, string> = {}

  if (typeof body.name !== 'string' || !body.name.trim()) fields.name = 'Name is required.'
  else if (body.name.length > 255) fields.name = 'Name must be 255 characters or fewer.'

  if (typeof body.pricePkr !== 'number' || !Number.isFinite(body.pricePkr)) {
    fields.pricePkr = 'Price is required.'
  } else if (body.pricePkr < 0) {
    fields.pricePkr = 'Price cannot be negative.'
  }

  const courses = body.courses
  if (!Array.isArray(courses) || courses.length < 1) {
    fields.courses = 'Add at least one section.'
  } else if (courses.length > 20) {
    fields.courses = 'A menu option can have at most 20 sections.'
  } else {
    courses.forEach((raw, index) => {
      const course = raw as Partial<ComboCourse>
      const items = Array.isArray(course.options) ? course.options : []

      if (typeof course.course !== 'string' || !course.course.trim()) {
        fields[`courses.${String(index)}.course`] = 'Section name is required.'
      }
      if (items.length < 1) {
        fields[`courses.${String(index)}.options`] = 'Add at least one item.'
      }
      if (
        typeof course.choose !== 'number' ||
        !Number.isInteger(course.choose) ||
        course.choose < 1
      ) {
        fields[`courses.${String(index)}.choose`] = 'Choice of must be at least 1.'
      } else if (items.length > 0 && course.choose > items.length) {
        fields[`courses.${String(index)}.choose`] =
          "You can't ask diners to choose more items than the section offers."
      }
    })
  }

  return Object.keys(fields).length > 0
    ? errorResponse('ERR_VALIDATION', 'Please correct the highlighted fields.', 422, { fields })
    : null
}

function toDraft(body: Record<string, unknown>): {
  name: string
  pricePkr: number
  courses: ComboCourse[]
} {
  return {
    name: body.name as string,
    pricePkr: body.pricePkr as number,
    courses: (body.courses as ComboCourse[]).map((course) => ({
      course: course.course,
      choose: course.choose,
      options: [...course.options],
    })),
  }
}

export function createMockMenuOption(body: Record<string, unknown>): Response {
  const refused = readOnly()
  if (refused) return refused

  const invalid = validationFailure(body)
  if (invalid) return invalid

  idCounter += 1
  const created: MenuOption = {
    comboId: `c-${String(idCounter)}`,
    isHidden: false,
    ...toDraft(body),
  }
  options.push(created)

  return HttpResponse.json({ success: true, data: created }, { status: 201 })
}

export function updateMockMenuOption(comboId: string, body: Record<string, unknown>): Response {
  const refused = readOnly()
  if (refused) return refused

  const index = options.findIndex((option) => option.comboId === comboId)
  if (index < 0) return errorResponse('ERR_NOT_FOUND', 'Menu option not found.', 404)

  const invalid = validationFailure(body)
  if (invalid) return invalid

  // A full replace of name, price and every section — not a partial patch.
  options[index] = { ...options[index], ...toDraft(body) }
  return HttpResponse.json({ success: true, data: options[index] })
}

export function setMockMenuOptionVisibility(
  comboId: string,
  body: Record<string, unknown>,
): Response {
  const refused = readOnly()
  if (refused) return refused

  const option = options.find((item) => item.comboId === comboId)
  if (!option) return errorResponse('ERR_NOT_FOUND', 'Menu option not found.', 404)

  if (typeof body.hidden !== 'boolean') {
    return errorResponse('ERR_VALIDATION', 'Invalid request.', 422)
  }

  // Idempotent: setting a state that already holds is a successful no-op. Note
  // the asymmetry — the request key is `hidden`, the response key `isHidden`.
  option.isHidden = body.hidden
  return HttpResponse.json({
    success: true,
    data: { comboId, isHidden: option.isHidden },
  })
}

export function deleteMockMenuOption(comboId: string): Response {
  const refused = readOnly()
  if (refused) return refused

  const index = options.findIndex((option) => option.comboId === comboId)
  if (index < 0) return errorResponse('ERR_NOT_FOUND', 'Menu option not found.', 404)

  const upcomingTables = inUse.get(comboId)
  if (upcomingTables) {
    return errorResponse(
      'ERR_MENU_OPTION_IN_USE',
      "This menu option is used by an upcoming interest table and can't be deleted. You can hide it instead.",
      409,
      { upcomingTables },
    )
  }

  // Soft delete platform-wide; from the client's view the combo simply leaves.
  options.splice(index, 1)
  return HttpResponse.json({ success: true, data: { comboId, deleted: true } })
}

import { HttpError } from '../../../../shared/api/httpClient'
import { COMBO_LIMITS } from './constants'
import type { ComboDraft } from './types'

/**
 * Combo form validation (BR-06), mirroring the server rule for rule so a partner
 * hits an inline error rather than a round trip and a 422.
 *
 * Pure and translator-injected, so every boundary is testable without rendering
 * the modal.
 */

export interface SectionErrors {
  course?: string
  options?: string
  choose?: string
}

export interface ComboFormErrors {
  name?: string
  pricePkr?: string
  /** The section *count* — at least one, at most twenty. */
  courses?: string
  /** Per-section messages, keyed by index. */
  sections?: Record<number, SectionErrors>
  /**
   * Anything the server reported that could not be attributed to a field. Shown
   * above the form so a message is never silently dropped.
   */
  general?: string
}

type Translate = (key: string, options?: Record<string, unknown>) => string

const KEY = 'restaurants:partnerMenu.form.errors'

/** Two decimals, per `numeric(10,2)`. */
function hasTooManyDecimals(value: number): boolean {
  const decimals = value.toString().split('.')[1]
  return decimals !== undefined && decimals.length > COMBO_LIMITS.priceDecimals
}

function validateSection(course: ComboDraft['courses'][number], t: Translate): SectionErrors {
  const errors: SectionErrors = {}
  const name = course.course.trim()
  const items = course.options

  if (!name) errors.course = t(`${KEY}.courseRequired`)
  else if (name.length > COMBO_LIMITS.courseNameMax) {
    errors.course = t(`${KEY}.courseTooLong`, { max: COMBO_LIMITS.courseNameMax })
  }

  if (items.length < COMBO_LIMITS.optionsMin) errors.options = t(`${KEY}.optionsRequired`)
  else if (items.length > COMBO_LIMITS.optionsMax) {
    errors.options = t(`${KEY}.optionsTooMany`, { max: COMBO_LIMITS.optionsMax })
  } else if (items.some((item) => item.trim().length > COMBO_LIMITS.optionMax)) {
    errors.options = t(`${KEY}.optionTooLong`, { max: COMBO_LIMITS.optionMax })
  }

  if (!Number.isInteger(course.choose) || course.choose < 1) {
    errors.choose = t(`${KEY}.chooseMin`)
  } else if (items.length > 0 && course.choose > items.length) {
    // The backend's own wording — it reads better than a numeric range.
    errors.choose = t(`${KEY}.chooseTooMany`)
  }

  return errors
}

export function validateCombo(draft: ComboDraft, t: Translate): ComboFormErrors {
  const errors: ComboFormErrors = {}

  const name = draft.name.trim()
  if (!name) errors.name = t(`${KEY}.nameRequired`)
  else if (name.length > COMBO_LIMITS.nameMax) {
    errors.name = t(`${KEY}.nameTooLong`, { max: COMBO_LIMITS.nameMax })
  }

  // A finiteness check and an explicit `< 0`, never a truthiness test: 0 is a
  // valid complimentary combo and `!price` would reject it. `Number.isFinite`
  // also covers the null an empty InputNumber yields at runtime.
  if (!Number.isFinite(draft.pricePkr)) {
    errors.pricePkr = t(`${KEY}.priceRequired`)
  } else if (draft.pricePkr < COMBO_LIMITS.priceMin) {
    errors.pricePkr = t(`${KEY}.priceNegative`)
  } else if (hasTooManyDecimals(draft.pricePkr)) {
    errors.pricePkr = t(`${KEY}.priceDecimals`, { max: COMBO_LIMITS.priceDecimals })
  }

  if (draft.courses.length < COMBO_LIMITS.coursesMin) errors.courses = t(`${KEY}.sectionsRequired`)
  else if (draft.courses.length > COMBO_LIMITS.coursesMax) {
    errors.courses = t(`${KEY}.sectionsTooMany`, { max: COMBO_LIMITS.coursesMax })
  }

  const sections: Record<number, SectionErrors> = {}
  draft.courses.forEach((course, index) => {
    const found = validateSection(course, t)
    if (Object.keys(found).length > 0) sections[index] = found
  })
  if (Object.keys(sections).length > 0) errors.sections = sections

  return errors
}

export function hasErrors(errors: ComboFormErrors): boolean {
  const formLevel = [errors.name, errors.pricePkr, errors.courses, errors.general]
  if (formLevel.some(Boolean)) return true
  return Object.values(errors.sections ?? {}).some((section) => Object.keys(section).length > 0)
}

const SECTION_FIELDS = ['course', 'options', 'choose'] as const
type SectionField = (typeof SECTION_FIELDS)[number]

function isSectionField(value: string): value is SectionField {
  return (SECTION_FIELDS as readonly string[]).includes(value)
}

/** `details.fields` values may be a string or a list of them. */
function firstMessage(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value
  if (Array.isArray(value)) {
    const found = value.find((entry) => typeof entry === 'string' && entry.trim())
    if (typeof found === 'string') return found
  }
  return undefined
}

/**
 * Reads a section index out of a `details.fields` key.
 *
 * The backend documents `details.fields` without pinning the path syntax, so
 * both `courses[0].choose` and `courses.0.choose` are accepted. A bare
 * `choose` — no index at all — is attributed to the **first** section, which is
 * exactly right for a single-section combo and the only defensible anchor
 * otherwise. Worth narrowing once the backend confirms which form it emits.
 */
function parseFieldPath(key: string): { index: number; field: SectionField } | null {
  const match = /^courses(?:\[(\d+)\]|\.(\d+))\.(\w+)$/.exec(key)
  if (match) {
    const index = Number(match[1] ?? match[2])
    return isSectionField(match[3]) ? { index, field: match[3] } : null
  }
  return isSectionField(key) ? { index: 0, field: key } : null
}

/**
 * Turns a 422's `details.fields` into the same error shape the form already
 * renders, so a server-only rule points at the offending input rather than only
 * raising a toast.
 *
 * Every message is surfaced: anything that cannot be attributed to a field lands
 * in `general` instead of being dropped.
 */
export function mapServerFieldErrors(error: unknown): ComboFormErrors {
  if (!(error instanceof HttpError)) return {}

  const body = error.responseBody as { error?: { details?: { fields?: unknown } } } | null
  const fields = body?.error?.details?.fields
  if (typeof fields !== 'object' || fields === null) return {}

  const errors: ComboFormErrors = {}
  const sections: Record<number, SectionErrors> = {}
  const unattributed: string[] = []

  Object.entries(fields as Record<string, unknown>).forEach(([key, value]) => {
    const message = firstMessage(value)
    if (!message) return

    if (key === 'name') {
      errors.name = message
      return
    }
    if (key === 'pricePkr' || key === 'price') {
      errors.pricePkr = message
      return
    }
    if (key === 'courses') {
      errors.courses = message
      return
    }

    const path = parseFieldPath(key)
    if (path) {
      sections[path.index] = { ...sections[path.index], [path.field]: message }
      return
    }
    unattributed.push(message)
  })

  if (Object.keys(sections).length > 0) errors.sections = sections
  if (unattributed.length > 0) errors.general = unattributed.join(' ')

  return errors
}

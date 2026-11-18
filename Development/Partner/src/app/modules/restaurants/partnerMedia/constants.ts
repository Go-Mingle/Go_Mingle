/**
 * J6B Restaurant Profile — Documents & Photos/Videos (Partner Portal).
 *
 * Thirteen client-callable endpoints. No restaurant id appears on any route: it
 * is resolved from the access token (F1 BR-04), and J6B accepts none from the
 * client — same as J6A.
 */
const ROOT = '/api/v1/partner/restaurant'

export const PARTNER_MEDIA_ENDPOINTS = {
  documents: `${ROOT}/documents`,
  documentUploadUrl: `${ROOT}/documents/upload-url`,
  documentDownloadUrl: (mediaId: string) => `${ROOT}/documents/${mediaId}/download-url`,
  documentById: (mediaId: string) => `${ROOT}/documents/${mediaId}`,

  /** Photos and videos in one payload — the gallery is a single read. */
  media: `${ROOT}/media`,

  photos: `${ROOT}/photos`,
  photoUploadUrl: `${ROOT}/photos/upload-url`,
  photoById: (mediaId: string) => `${ROOT}/photos/${mediaId}`,
  photoCover: (mediaId: string) => `${ROOT}/photos/${mediaId}/cover`,
  photoRole: (mediaId: string, role: 'cover' | 'profile') => `${ROOT}/photos/${mediaId}/${role}`,
  photoRoles: `${ROOT}/photo-roles`,
  cropUploadUrl: `${ROOT}/photos/crop-upload-url`,
  profilePhoto: `${ROOT}/profile-photo`,

  videos: `${ROOT}/videos`,
  videoUploadUrl: `${ROOT}/videos/upload-url`,
  videoById: (mediaId: string) => `${ROOT}/videos/${mediaId}`,
} as const

export const PARTNER_DOCUMENTS_QUERY_KEY = ['partner', 'restaurant', 'documents'] as const
export const PARTNER_MEDIA_QUERY_KEY = ['partner', 'restaurant', 'media'] as const

/** Documents list params. A bad value is a 422, not a silent default. */
export const DOCUMENT_SORT_FIELDS = ['name', 'type', 'size'] as const
export const SORT_ORDERS = ['asc', 'desc'] as const

/**
 * Accepted MIME types per kind (BR-06), used for the file picker's `accept`
 * filter and an immediate client-side type check.
 *
 * The server re-checks at commit by inspecting the stored object, so this is a
 * courtesy that saves a round trip — never the enforcement.
 */
export const ACCEPTED_TYPES = {
  document: [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ],
  photo: ['image/jpeg', 'image/png'],
  video: ['video/mp4'],
} as const

/** What the OS file dialog should offer, by kind. */
export const ACCEPT_ATTRIBUTE = {
  document: '.pdf,.docx,.jpg,.jpeg,.png',
  photo: '.jpg,.jpeg,.png',
  video: '.mp4',
} as const

/**
 * How often the gallery re-reads while a video is transcoding.
 *
 * There is no webhook — the provider reports readiness only when asked — so the
 * `processing` → `ready` transition is picked up by polling, and the poll stops
 * itself once nothing is processing (see `usePartnerMediaQuery`).
 */
export const VIDEO_POLL_MS = 5000

/**
 * J6B-specific error codes (spec §4.3). `ERR_PROFILE_READ_ONLY` is reused from
 * J6A and lives in that module's catalogue.
 */
export const MEDIA_ERROR_CODES = {
  LIMIT_REACHED: 'ERR_MEDIA_LIMIT_REACHED',
  TOO_LARGE: 'ERR_MEDIA_TOO_LARGE',
  BAD_TYPE: 'ERR_MEDIA_TYPE',
  COVER_REASSIGN: 'ERR_COVER_PHOTO_REASSIGN',
  VIDEO_PROVIDER: 'ERR_VIDEO_PROVIDER',
} as const

/** The frame each role is cut to, width ÷ height. Matches the API. */
export const ROLE_ASPECT = { cover: 8 / 3, profile: 1 } as const

/** Pixel size of the image cut for each role; never upscaled past the source. */
export const ROLE_OUTPUT = { cover: { width: 1600, height: 600 }, profile: { width: 640, height: 640 } } as const

export const PHOTO_ROLES_QUERY_KEY = ['partner', 'restaurant', 'photo-roles'] as const

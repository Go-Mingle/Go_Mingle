import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq, sql, ne } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { mediaCounters, mediaUploads, restaurantMedia, menuPdfs } from '../../db/schema'
import { cdnUrl, RestaurantsService, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { profileError, readOnly } from '../profile/profile.service'

export type MediaKind = 'document' | 'photo' | 'video'
export type MediaRow = typeof restaurantMedia.$inferSelect
export type UploadRow = typeof mediaUploads.$inferSelect

/** Config-driven in production; these are the defaults. */
export const LIMITS = {
  document: { maxBytes: 10 * 1024 * 1024, maxCount: 10 },
  photo: { maxBytes: 10 * 1024 * 1024, maxCount: 20 },
  video: { maxBytes: 200 * 1024 * 1024, maxCount: 5 },
} as const

const LIMIT_MESSAGE: Record<MediaKind, string> = {
  document: "You've reached the maximum number of documents.",
  photo: "You've reached the maximum number of photos.",
  video: "You've reached the maximum number of videos.",
}
const BAD_TYPE_DETAIL: Record<MediaKind, string> = {
  document: 'Only PDF, DOCX, JPG or PNG documents are allowed.',
  photo: 'Only JPG or PNG photos are allowed.',
  video: 'Only MP4 videos are allowed.',
}
const BUCKET = { document: 'restaurant-documents', photo: 'restaurant-multimedia', menu: 'restaurant-multimedia' } as const
const FOLDER = { document: 'documents', photo: 'photos', menu: 'menu' } as const

/** Leading bytes per verified type. Video bytes are not inspected. */
const SIGNATURE_BY_TYPE: Readonly<Record<string, readonly number[]>> = {
  'application/pdf': [0x25, 0x50, 0x44, 0x46],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
  'image/jpeg': [0xff, 0xd8, 0xff],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [0x50, 0x4b, 0x03, 0x04],
}

/** Whether the stored bytes match the declared type. An empty file never does. */
export function bytesMatchContentType(bytes: Buffer | null, contentType: string): boolean {
  if (!bytes || bytes.length === 0) return false
  const expected = SIGNATURE_BY_TYPE[contentType]
  return !expected || expected.every((byte, index) => bytes[index] === byte)
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot).toLowerCase() : ''
}

/** The wire `key` of an upload target: bucket-qualified, an echo for correlation only. */
export function bucketQualifiedKey(kind: keyof typeof BUCKET, restaurantId: string, objectId: string, fileName: string): string {
  return `${BUCKET[kind]}/restaurants/${restaurantId}/${FOLDER[kind]}/${objectId}${extensionOf(fileName)}`
}

export const uploadUrl = (restaurantId: string, ref: string, origin = 'mock-upload') =>
  `${config.publicUrl}/t/${encodeURIComponent(restaurantId)}/${origin}/${ref}`
export const streamUrl = (restaurantId: string, file: string) => `${config.publicUrl}/t/${encodeURIComponent(restaurantId)}/mock-stream/${file}`

/** Documents, photos and videos of a restaurant, and the three-step upload they arrive through. */
@Injectable()
export class MediaService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
  ) {}

  /** `u-1`, `doc-2`, `photo-3`…: one counter per restaurant. */
  async nextId(restaurantId: string, prefix: string): Promise<string> {
    const [row] = await this.db
      .insert(mediaCounters)
      .values({ restaurantId, nextId: 1 })
      .onConflictDoUpdate({ target: mediaCounters.restaurantId, set: { nextId: sql`${mediaCounters.nextId} + 1` } })
      .returning()
    return `${prefix}-${row.nextId}`
  }

  /** Counts a gallery read and returns the new total. */
  async countGalleryRead(restaurantId: string): Promise<number> {
    const [row] = await this.db
      .insert(mediaCounters)
      .values({ restaurantId, galleryReads: 1 })
      .onConflictDoUpdate({ target: mediaCounters.restaurantId, set: { galleryReads: sql`${mediaCounters.galleryReads} + 1` } })
      .returning()
    return row.galleryReads
  }

  async galleryReads(restaurantId: string): Promise<number> {
    const [row] = await this.db.select().from(mediaCounters).where(eq(mediaCounters.restaurantId, restaurantId))
    return row?.galleryReads ?? 0
  }

  list(restaurantId: string, kind: MediaKind): Promise<MediaRow[]> {
    return this.db
      .select()
      .from(restaurantMedia)
      .where(and(eq(restaurantMedia.restaurantId, restaurantId), eq(restaurantMedia.kind, kind)))
      .orderBy(asc(restaurantMedia.position))
  }

  async find(restaurantId: string, mediaId: string, kind?: MediaKind): Promise<MediaRow | null> {
    const [row] = await this.db
      .select()
      .from(restaurantMedia)
      .where(and(eq(restaurantMedia.restaurantId, restaurantId), eq(restaurantMedia.mediaId, mediaId)))
    return row && (!kind || row.kind === kind) ? row : null
  }

  async remove(restaurantId: string, mediaId: string): Promise<void> {
    await this.db.delete(restaurantMedia).where(and(eq(restaurantMedia.restaurantId, restaurantId), eq(restaurantMedia.mediaId, mediaId)))
  }

  /** Step 1: issues an upload target, refusing at the count limit before one exists. */
  async uploadTarget(r: Restaurant, kind: MediaKind, body: Record<string, unknown>) {
    if (r.status === 'PENDING') throw readOnly()
    const contentType = typeof body.contentType === 'string' ? body.contentType : ''
    const name = typeof body.name === 'string' ? body.name : ''
    if (!name || !contentType) throw profileError('ERR_VALIDATION', 'A name and content type are required.', 422)
    if ((await this.list(r.id, kind)).length >= LIMITS[kind].maxCount) throw profileError('ERR_MEDIA_LIMIT_REACHED', LIMIT_MESSAGE[kind], 409)

    const uploadRef = await this.nextId(r.id, 'u')
    await this.db.insert(mediaUploads).values({ restaurantId: r.id, uploadRef, kind, name, contentType })
    return {
      uploadUrl: uploadUrl(r.id, uploadRef),
      uploadRef,
      maxBytes: LIMITS[kind].maxBytes,
      // A video has no stored object and so no key: that absence tells the client which upload protocol to use.
      ...(kind === 'video' ? {} : { key: bucketQualifiedKey(kind, r.id, uploadRef, name), expiresInSeconds: 900 }),
    }
  }

  /** Step 2: the direct PUT/POST. Records that the bytes landed; false when the reference is unknown. */
  async receive(restaurantId: string, uploadRef: string, bytes: Buffer): Promise<boolean> {
    const rows = await this.db
      .update(mediaUploads)
      .set({ received: true, size: bytes.length, bytes })
      .where(and(eq(mediaUploads.restaurantId, restaurantId), eq(mediaUploads.uploadRef, uploadRef), ne(mediaUploads.kind, 'menu')))
      .returning({ ref: mediaUploads.uploadRef })
    return rows.length > 0
  }

  /**
   * Step 3: takes the staged upload a commit refers to, verified.
   * The reference is consumed before verification, so a failed commit cannot be retried.
   */
  async takeStaged(r: Restaurant, kind: MediaKind | 'menu', body: Record<string, unknown>, limits: { maxBytes: number }, badType: string): Promise<UploadRow> {
    if (typeof body.uploadRef !== 'string' || !body.uploadRef) throw profileError('ERR_VALIDATION', 'An uploadRef is required.', 422)
    const extras = Object.keys(body).filter((key) => key !== 'uploadRef')
    if (extras.length > 0) throw profileError('ERR_VALIDATION', `Property ${extras.join(', ')} is not allowed on this request.`, 422)
    if (r.status === 'PENDING') throw readOnly()

    const where = and(eq(mediaUploads.restaurantId, r.id), eq(mediaUploads.uploadRef, body.uploadRef), eq(mediaUploads.kind, kind))
    const [entry] = await this.db.select().from(mediaUploads).where(where)
    if (!entry) throw profileError('ERR_NOT_FOUND', 'No upload was found for that reference.', 404)
    if (!entry.received) throw profileError('ERR_VALIDATION', 'No uploaded object for that reference.', 422)
    await this.db.delete(mediaUploads).where(where)

    if (entry.size > limits.maxBytes) throw profileError('ERR_MEDIA_TOO_LARGE', 'This file is larger than the limit.', 413)
    if (!bytesMatchContentType(entry.bytes, entry.contentType)) {
      throw profileError('ERR_MEDIA_TYPE', "This file type isn't supported for this section.", 422, { contentType: entry.contentType, message: badType })
    }
    return entry
  }

  takeMedia(r: Restaurant, kind: MediaKind, body: Record<string, unknown>) {
    return this.takeStaged(r, kind, body, LIMITS[kind], BAD_TYPE_DETAIL[kind])
  }

  async add(r: Restaurant, kind: MediaKind, entry: UploadRow, prefix: string, extra: Partial<MediaRow> = {}): Promise<MediaRow> {
    const existing = await this.list(r.id, kind)
    const [row] = await this.db
      .insert(restaurantMedia)
      .values({
        restaurantId: r.id,
        mediaId: await this.nextId(r.id, prefix),
        kind,
        position: (existing.at(-1)?.position ?? 0) + 1,
        name: entry.name,
        contentType: entry.contentType,
        size: entry.size,
        uploadedAt: new Date().toISOString(),
        bytes: entry.bytes,
        ...extra,
      })
      .returning()
    return row
  }

  // ── Shapes ────────────────────────────────────────────────────────────────

  document(d: MediaRow) {
    return { mediaId: d.mediaId, name: d.name, type: (d.name.split('.').pop() ?? '').toUpperCase(), size: d.size, uploadedAt: d.uploadedAt }
  }

  photo(p: MediaRow, r: Pick<Restaurant, 'id' | 'mainPhotoKey'>) {
    return {
      mediaId: p.mediaId,
      name: p.name,
      // Always `.jpg`, whatever was uploaded: the served Content-Type decides how it renders.
      url: cdnUrl(r.id, `${p.mediaId}.jpg`),
      isCover: r.mainPhotoKey === `photos/${p.mediaId}.jpg`,
      size: p.size,
      uploadedAt: p.uploadedAt,
      sortOrder: p.sortOrder,
    }
  }

  video(v: MediaRow, reads: number) {
    const ready = reads >= (v.readyAfterReads ?? 0)
    return {
      mediaId: v.mediaId,
      name: v.name,
      status: ready ? 'ready' : 'processing',
      url: ready ? streamUrl(v.restaurantId, `${v.mediaId}.m3u8`) : null,
      thumbnailUrl: ready ? streamUrl(v.restaurantId, `${v.mediaId}.jpg`) : null,
      size: v.size,
      uploadedAt: v.uploadedAt,
      sortOrder: v.sortOrder,
    }
  }

  /** Photos and videos in one payload. Each read moves processing videos forward. */
  async gallery(restaurantId: string) {
    const r = (await this.restaurants.find(restaurantId)) as Restaurant
    const reads = await this.countGalleryRead(restaurantId)
    const photos = (await this.list(restaurantId, 'photo')).map((p) => this.photo(p, r))
    const videos = (await this.list(restaurantId, 'video')).map((v) => this.video(v, reads))
    return { photos, videos }
  }

  /** An uploaded menu PDF, by its CDN file name. */
  async menuPdf(restaurantId: string, file: string): Promise<Buffer | null> {
    const [row] = await this.db.select().from(menuPdfs).where(and(eq(menuPdfs.restaurantId, restaurantId), eq(menuPdfs.file, file)))
    return row?.bytes ?? null
  }

  downloadUrl(restaurantId: string, mediaId: string) {
    return uploadUrl(restaurantId, `signed-get/${mediaId}`)
  }

  /** Dropping the cover takes the restaurant off the app: visibility cannot stand without a cover photo. */
  dropCover(restaurantId: string) {
    return this.restaurants.update(restaurantId, { mainPhotoKey: null, visibleOnApp: false })
  }
}

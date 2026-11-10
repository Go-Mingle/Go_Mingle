import { bigint, boolean, customType, integer, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

const bytea = customType<{ data: Buffer }>({ dataType: () => 'bytea' })

/**
 * Per-restaurant counters: the next media id, and how many times the gallery
 * was read (a video finishes processing on the read after its upload).
 */
export const mediaCounters = pgTable('media_counters', {
  restaurantId: text('restaurant_id').primaryKey(),
  nextId: integer('next_id').notNull().default(0),
  galleryReads: integer('gallery_reads').notNull().default(0),
})

/** Upload targets issued but not yet committed (step 1 and 2 of an upload). */
export const mediaUploads = pgTable(
  'media_uploads',
  {
    restaurantId: text('restaurant_id').notNull(),
    uploadRef: text('upload_ref').notNull(),
    /** document | photo | video | menu */
    kind: text('kind').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    received: boolean('received').notNull().default(false),
    size: bigint('size', { mode: 'number' }).notNull().default(0),
    bytes: bytea('bytes'),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.uploadRef] })],
)

/** A restaurant's documents, photos and videos. The bytes move to S3 at go-live (GM-247). */
export const restaurantMedia = pgTable(
  'restaurant_media',
  {
    restaurantId: text('restaurant_id').notNull(),
    mediaId: text('media_id').notNull(),
    /** document | photo | video */
    kind: text('kind').notNull(),
    position: integer('position').notNull(),
    name: text('name').notNull(),
    contentType: text('content_type').notNull(),
    size: bigint('size', { mode: 'number' }).notNull(),
    uploadedAt: text('uploaded_at').notNull(),
    sortOrder: integer('sort_order'),
    /** Videos: the gallery read on which processing completes. */
    readyAfterReads: integer('ready_after_reads'),
    bytes: bytea('bytes'),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.mediaId] })],
)

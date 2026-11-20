import { bigint, boolean, doublePrecision, integer, jsonb, pgTable, primaryKey, serial, text, index } from 'drizzle-orm/pg-core'

export interface Rejection {
  reason: string
  /** 'DD-MM-YYYY HH:mm' Karachi time */
  rejectedAt: string
}

/** A rectangle of a photo, each value a fraction (0–1) of the photo's width or height. */
export interface Crop {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Restaurants: one row per restaurant, shared by both portals.
 *
 * The partner owns the profile fields; GoMingle admins own the review decision,
 * the category and suspension. `status` is the application lifecycle:
 *   DRAFT → (submit) PENDING → (approve) ACTIVE | (decline) REJECTED → (resubmit) PENDING
 * The Admin Panel sees a restaurant from its first submission on, and shows a
 * suspended ACTIVE restaurant as SUSPENDED.
 */
export const restaurants = pgTable(
  'restaurants',
  {
    id: text('id').primaryKey(),
    seq: serial('seq').notNull(),
    createdAt: text('created_at').notNull(),

    // Profile (partner)
    name: text('name'),
    cuisine: text('cuisine'),
    description: text('description'),
    areaDistrict: text('area_district'),
    city: text('city'),
    fullAddress: text('full_address'),
    latitude: doublePrecision('latitude'),
    longitude: doublePrecision('longitude'),
    ownerName: text('owner_name'),
    ownerEmail: text('owner_email'),
    ownerPhone: text('owner_phone'),
    restaurantPhone: text('restaurant_phone'),
    restaurantEmail: text('restaurant_email'),
    website: text('website'),
    houseRules: text('house_rules'),
    dressCode: text('dress_code'),
    servesAlcohol: boolean('serves_alcohol'),
    /** The cover's source photo, `photos/<mediaId>.jpg`. */
    mainPhotoKey: text('main_photo_key'),
    /** The part of the source the partner kept for the cover (8:3), as fractions; null = the whole photo. */
    coverCrop: jsonb('cover_crop').$type<Crop>(),
    /** The cropped cover image (a `crop` media row); null = serve the source. */
    coverImageId: text('cover_image_id'),
    /** The profile picture's source photo, `photos/<mediaId>.jpg`; null = none chosen. */
    profilePhotoKey: text('profile_photo_key'),
    /** The square part of the source kept for the profile picture, as fractions. */
    profileCrop: jsonb('profile_crop').$type<Crop>(),
    /** The cropped profile picture (a `crop` media row). */
    profileImageId: text('profile_image_id'),
    visibleOnApp: boolean('visible_on_app').notNull().default(false),
    amenityIds: jsonb('amenity_ids').$type<string[]>().notNull().default([]),

    // Lifecycle
    /** DRAFT | PENDING | ACTIVE | REJECTED */
    status: text('status').notNull().default('DRAFT'),
    suspended: boolean('suspended').notNull().default(false),
    /** Archived by a GoMingle admin (ISO time): hidden from the app and the directory, data kept. */
    archivedAt: text('archived_at'),
    rejections: jsonb('rejections').$type<Rejection[]>().notNull().default([]),
    /** When it first entered the approval queue (ms); null until first submitted. */
    firstSubmittedAt: bigint('first_submitted_at', { mode: 'number' }),
    /** Date (YYYY-MM-DD) of the latest submission. */
    submitted: text('submitted'),
    rejectionReason: text('rejection_reason'),
    rejectedOn: text('rejected_on'),
    /** Date (YYYY-MM-DD) it joined: first submission, then the approval date. */
    joined: text('joined'),
    categoryId: text('category_id'),
    /** When a GoMingle admin created this profile for the owner to complete (ms); null when the owner signed up. */
    invitedAt: bigint('invited_at', { mode: 'number' }),
    /** The admin who created it. */
    invitedBy: text('invited_by'),
    payoutAccountId: text('payout_account_id'),

    // Menu PDF currently shown (file in menu_pdfs)
    menuPdfFile: text('menu_pdf_file'),
    menuPdfName: text('menu_pdf_name'),

    // No-show policy (GM-204). Applies to bookings made from now on.
    /** Charged per empty seat; 0 = no penalty and no card hold. */
    noShowPenaltyPerSeatPkr: doublePrecision('no_show_penalty_per_seat_pkr').notNull().default(0),
    /** A Mingler can cancel free of charge until this many hours before the table starts. */
    cancellationWindowHours: integer('cancellation_window_hours').notNull().default(24),
  },
  (t) => [index('restaurants_status').on(t.status)],
)

/** People to contact at a restaurant. Soft-deleted so ids are never reused. */
export const restaurantContacts = pgTable(
  'restaurant_contacts',
  {
    restaurantId: text('restaurant_id').notNull(),
    id: text('id').notNull(),
    name: text('name').notNull(),
    title: text('title'),
    email: text('email'),
    phone: text('phone'),
    deleted: boolean('deleted').notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.restaurantId, t.id] })],
)

/** Admin Panel inbox (platform-wide). */
export const adminNotifications = pgTable('admin_notifications', {
  id: text('id').primaryKey(),
  seq: serial('seq').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  deepLink: text('deep_link'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  /** 'DD-MM-YYYY HH:mm' Karachi time */
  createdAt: text('created_at').notNull(),
  readAt: text('read_at'),
  readByUserId: text('read_by_user_id'),
})

/** Partner Portal inbox, per restaurant. */
export const partnerNotifications = pgTable(
  'partner_notifications',
  {
    id: text('id').primaryKey(),
    seq: serial('seq').notNull(),
    restaurantId: text('restaurant_id').notNull(),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    deepLink: text('deep_link'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: text('created_at').notNull(),
    readAt: text('read_at'),
  },
  (t) => [index('partner_notifications_restaurant_created').on(t.restaurantId, t.createdAt)],
)

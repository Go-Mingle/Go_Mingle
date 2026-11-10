import crypto from 'node:crypto'
import { Inject, Injectable } from '@nestjs/common'
import { and, asc, eq } from 'drizzle-orm'
import { config } from '../../config'
import { DB, type Db } from '../../db/database'
import { categories, restaurantContacts, restaurants } from '../../db/schema'
import { today } from '../../common/time'

export type Restaurant = typeof restaurants.$inferSelect
export type Contact = typeof restaurantContacts.$inferSelect
export type PartnerRoute = 'PROFILE_SETUP' | 'UNDER_REVIEW' | 'REJECTED' | 'FULL_PORTAL'

/** The portal route a partner lands on, from their restaurant's status. */
export function routeFor(status: string): PartnerRoute {
  switch (status) {
    case 'DRAFT':
      return 'PROFILE_SETUP'
    case 'PENDING':
      return 'UNDER_REVIEW'
    case 'REJECTED':
      return 'REJECTED'
    default:
      return 'FULL_PORTAL'
  }
}

/** Phone numbers are stored as compact E.164; the admin screens show them spaced. */
export function displayPhone(e164: string | null | undefined): string {
  const digits = String(e164 ?? '').replace(/\D/g, '')
  // Karachi landline: +92 21 XXXX XXXX
  if (digits.length === 12 && digits.startsWith('9221')) return `+92 21 ${digits.slice(4, 8)} ${digits.slice(8)}`
  if (digits.length === 12 && digits.startsWith('92')) return `+92 ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`
  return e164 ?? ''
}

/** The status the Admin Panel shows: a suspended live restaurant is SUSPENDED. */
export function adminStatus(r: Restaurant): string {
  return r.status === 'ACTIVE' && r.suspended ? 'SUSPENDED' : r.status
}

/** Public URL of a file a restaurant uploaded to the media CDN. */
export function cdnUrl(restaurantId: string, file: string): string {
  return `${config.publicUrl}/t/${encodeURIComponent(restaurantId)}/mock-cdn/${file}`
}

/** The cover's public URL. The cover key is `photos/<mediaId>.jpg`, stored on the CDN as `<mediaId>.jpg`. */
export function coverPhotoUrl(r: Pick<Restaurant, 'id' | 'mainPhotoKey'>): string | null {
  if (!r.mainPhotoKey) return null
  return cdnUrl(r.id, r.mainPhotoKey.split('/').pop() ?? r.mainPhotoKey)
}

export const newRestaurantId = () => `rest-${crypto.randomBytes(3).toString('hex')}`

/** Restaurants shared by both portals. */
@Injectable()
export class RestaurantsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  async find(id: string): Promise<Restaurant | null> {
    const [r] = await this.db.select().from(restaurants).where(eq(restaurants.id, id))
    return r ?? null
  }

  /** The restaurant, created as an empty Draft the first time its owner arrives. */
  async ensure(id: string): Promise<Restaurant> {
    const existing = await this.find(id)
    if (existing) return existing
    const [r] = await this.db.insert(restaurants).values({ id, createdAt: today() }).onConflictDoNothing().returning()
    return r ?? ((await this.find(id)) as Restaurant)
  }

  async update(id: string, changes: Partial<Restaurant>): Promise<Restaurant> {
    const [r] = await this.db.update(restaurants).set(changes).where(eq(restaurants.id, id)).returning()
    return r
  }

  /** Restaurants the Admin Panel knows: everything that has been submitted at least once. */
  async submitted(): Promise<Restaurant[]> {
    const rows = await this.db.select().from(restaurants).orderBy(asc(restaurants.seq))
    return rows.filter((r) => r.firstSubmittedAt !== null)
  }

  async category(r: Pick<Restaurant, 'categoryId'>) {
    if (!r.categoryId) return null
    const [c] = await this.db.select().from(categories).where(eq(categories.id, r.categoryId))
    return c ?? null
  }

  async contacts(restaurantId: string, includeDeleted = false): Promise<Contact[]> {
    const rows = await this.db
      .select()
      .from(restaurantContacts)
      .where(
        includeDeleted
          ? eq(restaurantContacts.restaurantId, restaurantId)
          : and(eq(restaurantContacts.restaurantId, restaurantId), eq(restaurantContacts.deleted, false)),
      )
    // Insertion order: ids are ct-1, ct-2, …
    return rows.sort((a, b) => Number(a.id.slice(3)) - Number(b.id.slice(3)))
  }
}

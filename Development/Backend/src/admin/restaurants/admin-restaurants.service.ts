import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { DB, type Db } from '../../db/database'
import { asc, eq } from 'drizzle-orm'
import { amenities, categories, menuOptions, restaurantTables } from '../../db/schema'
import { menuPdfUrl } from '../../partner/venue/menu.controller'
import { ChangeLogService } from '../../shared/changelog/changelog.service'
import { adminStatus, coverPhotoUrl, displayPhone, RestaurantsService, type Restaurant } from '../../shared/restaurants/restaurants.service'
import { UsageService } from '../../shared/usage.service'

type Category = typeof categories.$inferSelect

/**
 * How the Admin Panel sees restaurants. A restaurant appears here from its
 * first submission on; the partner's row is read live, so nothing is copied
 * between the portals.
 */
@Injectable()
export class AdminRestaurantsService implements OnModuleInit {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
    private readonly usage: UsageService,
    private readonly changeLog: ChangeLogService,
  ) {}

  onModuleInit() {
    this.changeLog.registerTarget('restaurants', async (id) => {
      const r = await this.known(id)
      return r ? { name: r.name, record: this.detail(r, await this.restaurants.category(r)) } : null
    })
    this.usage.provide({
      category: async (id) => (await this.all()).filter((r) => r.categoryId === id).length,
      amenity: async (id) => {
        const using = (await this.all()).filter((r) => r.amenityIds.includes(id))
        return { restaurantsCount: using.length, sampleRestaurants: using.slice(0, 3).map((r) => ({ id: r.id, name: r.name ?? '' })) }
      },
    })
  }

  /** Every restaurant the Admin Panel knows, newest application first. */
  async all(): Promise<Restaurant[]> {
    const rows = await this.restaurants.submitted()
    return rows.sort((a, b) => (b.firstSubmittedAt ?? 0) - (a.firstSubmittedAt ?? 0) || b.seq - a.seq)
  }

  /** A restaurant the Admin Panel can open (never a Draft that was not submitted yet). */
  async known(id: string): Promise<Restaurant | null> {
    const r = await this.restaurants.find(id)
    return r && r.firstSubmittedAt !== null ? r : null
  }

  async categoriesById(): Promise<Map<string, Category>> {
    return new Map((await this.db.select().from(categories)).map((c) => [c.id, c]))
  }

  listItem(r: Restaurant, category: Category | null | undefined) {
    return {
      id: r.id,
      name: r.name ?? '',
      cuisine: r.cuisine ?? '',
      city: r.city ?? '',
      category: category ? { id: category.id, name: category.name } : null,
      confirmedBookings: 0,
      joinedAt: r.joined,
      status: adminStatus(r),
      visibleOnApp: r.visibleOnApp,
      avatarUrl: coverPhotoUrl(r),
    }
  }

  detail(r: Restaurant, category: Category | null | undefined) {
    return {
      id: r.id,
      name: r.name ?? '',
      status: adminStatus(r),
      visibleOnApp: r.visibleOnApp,
      category: category ? { id: category.id, name: category.name } : null,
      cuisine: r.cuisine ?? '',
      description: r.description ?? '',
      seatingCapacity: 0,
      phone: r.restaurantPhone ? displayPhone(r.restaurantPhone) : '',
      email: r.restaurantEmail ?? '',
      website: r.website ?? '',
      fullAddress: r.fullAddress ?? '',
      areaDistrict: r.areaDistrict ?? '',
      city: r.city ?? '',
      latitude: r.latitude,
      longitude: r.longitude,
      ownerName: r.ownerName ?? '',
      ownerPhone: r.ownerPhone ? displayPhone(r.ownerPhone) : '',
      ownerEmail: r.ownerEmail ?? '',
      businessRegNo: '',
      servesAlcohol: r.servesAlcohol,
      houseRules: r.houseRules ?? '',
      dressCode: r.dressCode ?? '',
      joinedAt: r.joined,
      confirmedBookings: 0,
      avatarUrl: coverPhotoUrl(r),
      menuPdfUrl: menuPdfUrl(r),
    }
  }

  /** The amenities a restaurant ticked, by name. */
  async amenitiesOf(r: Restaurant) {
    const rows = await this.db.select().from(amenities)
    return rows
      .filter((a) => r.amenityIds.includes(a.id))
      .map((a) => ({ id: a.id, name: a.name, iconUrl: a.iconUrl }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /** Bookable table areas with their weekly hours in 12-hour time; hidden areas are left out. */
  async tablesOf(r: Restaurant) {
    const rows = await this.db.select().from(restaurantTables).where(eq(restaurantTables.restaurantId, r.id)).orderBy(asc(restaurantTables.seq))
    return rows
      .filter((t) => !t.isHidden)
      .map((t) => ({
        id: t.tableId,
        name: t.name,
        availability: ['0', '1', '2', '3', '4', '5', '6'].flatMap((day) =>
          (t.availability[day] ?? []).map((range) => ({ dayOfWeek: Number(day), start: to12h(range.start), end: to12h(range.end) })),
        ),
      }))
  }

  /** Menu options on offer; hidden ones are left out. */
  async menuOptionsOf(r: Restaurant) {
    const rows = await this.db.select().from(menuOptions).where(eq(menuOptions.restaurantId, r.id)).orderBy(asc(menuOptions.seq))
    return rows.filter((o) => !o.isHidden).map((o) => ({ id: o.comboId, name: o.name, pricePkr: o.pricePkr, courses: o.courses }))
  }
}

/** `18:30` → `6:30 PM`. */
function to12h(hhmm: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm)
  if (!m) return hhmm
  const h = Number(m[1])
  return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`
}

import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { categories } from '../../db/schema'
import { karachiStamp, today } from '../../common/time'
import { NotificationsService } from '../notifications/notifications.service'
import { MailService } from '../email/mail.service'
import { RestaurantsService, type Restaurant } from './restaurants.service'

/**
 * Restaurant lifecycle across both portals.
 *
 *   Partner signs up ─► profile setup (DRAFT) ─► submits (PENDING)
 *        │                                          │
 *        │                          Admin approval queue lists it, admin is notified
 *        │                                          │
 *        │                 approve (category) ──────┴────── decline (reason)
 *        ▼                        │                              │
 *   partner session           ACTIVE: in the admin          REJECTED: partner sees the
 *   follows the status        directory, partner gets       reason, edits and resubmits
 *                             the full portal
 */
@Injectable()
export class ReviewService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly restaurants: RestaurantsService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  /** Partner submitted (or resubmitted) their profile for review. */
  async submitted(r: Restaurant): Promise<Restaurant> {
    const first = r.firstSubmittedAt === null
    const updated = await this.restaurants.update(r.id, {
      status: 'PENDING',
      suspended: false,
      // Past decline reasons are hidden on resubmit.
      rejections: [],
      rejectionReason: null,
      rejectedOn: null,
      submitted: today(),
      firstSubmittedAt: r.firstSubmittedAt ?? Date.now(),
      joined: r.joined ?? today(),
    })
    await this.notifications.notifyAdmins({
      type: 'RESTAURANT_APPLICATION_SUBMITTED',
      title: first ? 'New Restaurant Application' : 'Restaurant Application Resubmitted',
      body: `${r.name} (${r.city ?? 'Karachi'}) submitted an application for approval.`,
      deepLink: `/admin/approvals/${r.id}`,
      metadata: { restaurantId: r.id, restaurantName: r.name },
    })
    await this.mail.toApprovers('admin_new_application', { restaurantName: r.name, city: r.city ?? 'Karachi' })
    return updated
  }

  /** Admin approved an application (pending or previously declined). */
  async approve(id: string, categoryId: string) {
    const r = await this.application(id)
    if (!r) return null
    const [category] = await this.db.select().from(categories).where(eq(categories.id, categoryId))
    if (!category) return { error: 'CATEGORY' as const }
    await this.restaurants.update(id, {
      status: 'ACTIVE',
      suspended: false,
      visibleOnApp: true,
      rejections: [],
      joined: today(),
      categoryId: category.id,
    })
    await this.notifications.notifyPartner(id, {
      type: 'RESTAURANT_APPROVED',
      title: 'Your restaurant is live',
      body: `${r.name} was approved in the ${category.name} category and is now visible to Minglers on GoMingle.`,
      deepLink: '/overview',
      metadata: { restaurantId: id },
    })
    await this.mail.toRestaurantOwner(id, 'restaurant_approved', { restaurantName: r.name, category: category.name })
    return { id, status: 'APPROVED', category: { id: category.id, name: category.name }, name: r.name }
  }

  /** Admin declined an application with a reason. */
  async decline(id: string, reason: string) {
    const r = await this.application(id)
    if (!r) return null
    const rejectedAt = new Date().toISOString()
    await this.restaurants.update(id, {
      status: 'REJECTED',
      suspended: false,
      rejectionReason: reason,
      rejectedOn: today(),
      rejections: [{ reason, rejectedAt: karachiStamp() }, ...(r.rejections ?? [])],
    })
    await this.notifications.notifyPartner(id, {
      type: 'RESTAURANT_REJECTED',
      title: 'Application needs changes',
      body: `Your application was declined: ${reason}`,
      deepLink: '/overview',
      metadata: { restaurantId: id },
    })
    await this.mail.toRestaurantOwner(id, 'restaurant_declined', { restaurantName: r.name, reason })
    return { id, status: 'REJECTED', rejectedAt, name: r.name }
  }

  /** Admin suspended a live restaurant: hidden from the Mingler app until reactivated. */
  async suspend(id: string, reason?: string) {
    const r = await this.restaurants.update(id, { suspended: true, visibleOnApp: false })
    await this.notifications.notifyPartner(id, {
      type: 'RESTAURANT_SUSPENDED',
      title: 'Restaurant suspended',
      body: reason ? `GoMingle suspended your restaurant: ${reason}` : 'GoMingle suspended your restaurant. New bookings are paused.',
      deepLink: '/overview',
      metadata: { restaurantId: id },
    })
    await this.mail.toRestaurantOwner(id, 'restaurant_suspended', {
      restaurantName: r?.name ?? 'Your restaurant',
      reason: reason || 'Not given. Contact GoMingle support for details.',
    })
  }

  async unsuspend(id: string) {
    const r = await this.restaurants.update(id, { suspended: false, visibleOnApp: true })
    await this.notifications.notifyPartner(id, {
      type: 'RESTAURANT_UNSUSPENDED',
      title: 'Restaurant reactivated',
      body: 'Your restaurant is live on GoMingle again.',
      deepLink: '/overview',
      metadata: { restaurantId: id },
    })
    await this.mail.toRestaurantOwner(id, 'restaurant_reactivated', { restaurantName: r?.name ?? 'Your restaurant' })
  }

  /** Admin moved the restaurant to another category. */
  async changeCategory(id: string, category: { id: string; name: string; commissionRate: number | null }) {
    await this.restaurants.update(id, { categoryId: category.id })
    await this.notifications.notifyPartner(id, {
      type: 'RESTAURANT_CATEGORY_CHANGED',
      title: 'Category updated',
      body: `GoMingle moved your restaurant to the ${category.name} category (${category.commissionRate}% commission).`,
      deepLink: '/overview',
      metadata: { restaurantId: id },
    })
  }

  /** A restaurant that has an application (was submitted at least once). */
  private async application(id: string): Promise<Restaurant | null> {
    const r = await this.restaurants.find(id)
    return r && r.firstSubmittedAt !== null ? r : null
  }
}

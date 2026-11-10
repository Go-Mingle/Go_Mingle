import { Inject, Injectable } from '@nestjs/common'
import { DB, type Db } from '../../db/database'
import { adminNotifications, partnerNotifications } from '../../db/schema'
import { karachiStamp } from '../../common/time'

export interface NewNotification {
  type: string
  title: string
  body: string
  deepLink: string
  metadata: Record<string, unknown>
}

const newId = () => `n-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Karachi wall-clock with its offset, e.g. 2026-11-10T16:20:00+05:00 (never `Z`). */
export function karachiIso(date = new Date()): string {
  return `${new Date(date.getTime() + 5 * 3_600_000).toISOString().slice(0, 19)}+05:00`
}

/** Writes to the two inboxes when something happens across the portals. */
@Injectable()
export class NotificationsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Adds a notification to the Admin Panel inbox. */
  async notifyAdmins(item: NewNotification): Promise<void> {
    await this.db.insert(adminNotifications).values({ id: newId(), ...item, createdAt: karachiStamp() })
  }

  /** Adds a notification to a restaurant's Partner Portal inbox. */
  async notifyPartner(restaurantId: string, item: NewNotification): Promise<void> {
    await this.db.insert(partnerNotifications).values({ id: newId(), restaurantId, ...item, createdAt: karachiIso() })
  }
}

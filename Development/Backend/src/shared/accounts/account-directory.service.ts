import { Inject, Injectable } from '@nestjs/common'
import { and, eq, ne } from 'drizzle-orm'
import { DB, type Db } from '../../db/database'
import { adminUsers, partnerUsers } from '../../db/schema'
import { normaliseEmail } from '../../auth/passwords'

/**
 * Sign-in emails are unique across both portals: an address used by an admin
 * cannot become a partner login and vice versa.
 */
@Injectable()
export class AccountDirectory {
  constructor(@Inject(DB) private readonly db: Db) {}

  async emailInUse(email: unknown): Promise<boolean> {
    const e = normaliseEmail(email)
    if (!e) return false
    const admins = await this.db.$count(adminUsers, and(eq(adminUsers.email, e), ne(adminUsers.status, 'DELETED')))
    if (admins) return true
    const partners = await this.db.$count(partnerUsers, and(eq(partnerUsers.email, e), ne(partnerUsers.status, 'DELETED')))
    return partners > 0
  }
}

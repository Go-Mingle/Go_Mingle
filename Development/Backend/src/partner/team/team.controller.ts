import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Req, UseGuards } from '@nestjs/common'
import { apiError } from '../../common/errors'
import { Body, Query, type Req as Request } from '../../common/http'
import { normaliseEmail } from '../../auth/passwords'
import { CurrentPartner, PartnerGuard } from '../access/partner.guard'
import { PartnerAccountsService, type PartnerUser } from '../access/partner-accounts.service'
import { MailService } from '../../shared/email/mail.service'
import { RestaurantsService } from '../../shared/restaurants/restaurants.service'

type Json = Record<string, unknown>

/** Team errors always carry `details: null`. */
const fail = (status: number, code: string, message: string) => apiError(status, code, message, null)
const notFound = () => fail(404, 'ERR_NOT_FOUND', 'User not found.')
const primary = () => fail(403, 'ERR_FORBIDDEN_PRIMARY', 'An owner cannot be suspended or removed here.')
const ownerOnly = () => fail(403, 'ERR_OWNER_ONLY', 'Only an owner can manage users.')
const otherOwner = () => fail(403, 'ERR_FORBIDDEN_PRIMARY', "Only GoMingle can change another owner's sign-in.")

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/
const SORTERS: Record<string, (a: PartnerUser, b: PartnerUser) => number> = {
  name: (a, b) => a.fullName.localeCompare(b.fullName),
  designation: (a, b) => a.designation.localeCompare(b.designation),
  lastActive: (a, b) => (a.lastActiveAt ?? '').localeCompare(b.lastActiveAt ?? ''),
  status: (a, b) => a.status.localeCompare(b.status),
}

/** What everyone on the team sees about a colleague. */
const card = (u: PartnerUser) => ({
  id: u.id,
  fullName: u.fullName,
  designation: u.designation || null,
  email: u.email,
  role: u.isPrimary ? ('OWNER' as const) : ('MEMBER' as const),
  isPrimary: u.isPrimary,
})

/** A row of the owners' Team grid. Owners can be renamed but not suspended or removed here. */
const item = (u: PartnerUser) => ({
  ...card(u),
  lastActiveAt: u.lastActiveAt,
  status: u.status,
  canSuspend: !u.isPrimary,
  canDelete: !u.isPrimary,
})

/** Writes on the team are for owners only; the portal hides them from others, and this is the real check. */
function requireOwner(me: PartnerUser) {
  if (!me.isPrimary) throw ownerOnly()
}

/**
 * The restaurant's team: /partner/api/v1/partner/users
 * Every member is a sign-in account for the same restaurant, so suspending,
 * removing or resetting a password here takes effect on their next request.
 *
 * Everyone on the team can read the list; only owners can change it. A
 * restaurant can have several owners, and only a GoMingle admin can change
 * who they are.
 */
@Controller('partner/api/v1/partner/users')
@UseGuards(PartnerGuard)
export class TeamController {
  constructor(
    private readonly accounts: PartnerAccountsService,
    private readonly restaurants: RestaurantsService,
    private readonly mail: MailService,
  ) {}

  /** Tells a new (or returning) active member they can sign in. */
  private async welcome(member: PartnerUser, me: PartnerUser) {
    if (member.status !== 'ACTIVE') return
    const restaurant = await this.restaurants.find(me.restaurantId)
    await this.mail.send('partner_team_welcome', { email: member.email, name: member.fullName }, {
      name: member.fullName,
      restaurantName: restaurant?.name || 'your restaurant',
      addedBy: me.fullName,
      email: member.email,
    })
  }

  private async member(me: PartnerUser, id: string): Promise<PartnerUser> {
    const user = await this.accounts.byId(id)
    if (!user || user.restaurantId !== me.restaurantId || user.status === 'DELETED') throw notFound()
    return user
  }

  /** Forgiving by design: a bad sort, page or status falls back to the default grid. Only bad dates are refused. */
  @Get()
  async list(@CurrentPartner() me: PartnerUser, @Query() q: Record<string, string>, @Req() req: Request) {
    const from = q.lastActiveFrom
    const to = q.lastActiveTo
    if ((from && !DATE_ONLY.test(from)) || (to && !DATE_ONLY.test(to)) || (from && to && from > to)) {
      throw fail(400, 'ERR_VALIDATION', 'Invalid last-active date range.')
    }
    // `status` arrives as repeated keys or comma-separated.
    const raw = req.query.status
    const statuses = (raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]).flatMap((v) => String(v).split(',')).filter(Boolean)

    // Owners manage everyone; the rest of the team sees who is active.
    let rows = (await this.accounts.team(me.restaurantId)).filter((u) => (me.isPrimary ? u.status !== 'DELETED' : u.status === 'ACTIVE'))
    const search = q.search?.trim().toLowerCase()
    if (search) {
      rows = rows.filter((u) => {
        const name = u.fullName.toLowerCase().includes(search)
        const designation = u.designation.toLowerCase().includes(search)
        return q.searchField === 'name' ? name : q.searchField === 'designation' ? designation : name || designation
      })
    }
    if (statuses.length) rows = rows.filter((u) => statuses.includes(u.status))
    const day = (u: PartnerUser) => (u.lastActiveAt ?? '').slice(0, 10)
    if (from) rows = rows.filter((u) => !!u.lastActiveAt && day(u) >= from)
    if (to) rows = rows.filter((u) => !!u.lastActiveAt && day(u) <= to)

    const sorter = SORTERS[q.sortBy ?? '']
    if (sorter) {
      rows.sort(sorter)
      if (q.sortOrder === 'desc') rows.reverse()
    }

    const size = Number(q.pageSize)
    const pageSize = [10, 25, 50, 100].includes(size) ? size : 25
    const totalRecords = rows.length
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize))
    const wanted = Number(q.page)
    const page = !Number.isInteger(wanted) || wanted < 1 ? 1 : Math.min(wanted, totalPages)
    const start = (page - 1) * pageSize
    const shape = me.isPrimary ? item : card
    return {
      success: true,
      data: { items: rows.slice(start, start + pageSize).map(shape), pagination: { page, pageSize, totalRecords, totalPages }, canManage: me.isPrimary },
    }
  }

  @Post()
  @HttpCode(201)
  async create(@CurrentPartner() me: PartnerUser, @Body() body: Json) {
    requireOwner(me)
    const fullName = String(body.fullName ?? '').trim()
    const email = normaliseEmail(body.email)
    const password = String(body.password ?? '')
    // The restaurant comes from the session and there are no roles.
    if ('role' in body || 'isPrimary' in body || 'restaurantId' in body) throw fail(422, 'ERR_VALIDATION', 'Unexpected field.')
    if (!fullName) throw fail(422, 'ERR_VALIDATION', 'Name is required.')
    if (!email) throw fail(422, 'ERR_VALIDATION', 'Email is required.')
    if (!password || password !== String(body.confirmPassword ?? '')) throw fail(422, 'ERR_VALIDATION', 'Passwords do not match.')
    // One live account per email across GoMingle, so a member can always sign in.
    if (await this.accounts.byEmail(email)) throw fail(409, 'ERR_DUPLICATE_EMAIL', 'This email address is already registered.')

    const status = body.status === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE'
    const designation = typeof body.designation === 'string' ? body.designation.trim() : ''

    // Adding a removed member's email again brings that member back.
    const removed = (await this.accounts.team(me.restaurantId)).find((u) => u.email === email && u.status === 'DELETED')
    if (removed) {
      await this.accounts.setPassword(removed.id, password)
      const revived = await this.accounts.update(removed.id, { fullName, designation, status, lastActiveAt: null, failures: 0, lockedUntil: 0 })
      await this.welcome(revived, me)
      return { success: true, data: { ...item(revived), email: revived.email, reactivated: true } }
    }
    const created = await this.accounts.create({ email, fullName, restaurantId: me.restaurantId, isPrimary: false, designation, password, status, neverActive: true })
    await this.welcome(created, me)
    return { success: true, data: { ...item(created), email: created.email } }
  }

  /** Silent: the member is not emailed. */
  @Post(':userId/set-password')
  @HttpCode(200)
  async setPassword(@CurrentPartner() me: PartnerUser, @Param('userId') userId: string, @Body() body: Json) {
    requireOwner(me)
    const user = await this.member(me, userId)
    // Taking over a fellow owner's sign-in is for GoMingle, not the portal.
    if (user.isPrimary && user.id !== me.id) throw otherOwner()
    const password = String(body.password ?? '')
    if (!password || password !== String(body.confirmPassword ?? '')) throw fail(422, 'ERR_VALIDATION', 'Passwords do not match.')
    await this.accounts.setPassword(user.id, password)
    return { success: true, data: { passwordSet: true } }
  }

  @Patch(':userId')
  async update(@CurrentPartner() me: PartnerUser, @Param('userId') userId: string, @Body() body: Json) {
    requireOwner(me)
    if ('role' in body || 'email' in body || 'isPrimary' in body) throw fail(422, 'ERR_VALIDATION', 'That field cannot be changed.')
    const user = await this.member(me, userId)
    if (body.status === 'SUSPENDED' && user.isPrimary) throw primary()
    const changes: Partial<PartnerUser> = {}
    if (typeof body.fullName === 'string') changes.fullName = body.fullName.trim()
    // Leaving designation out keeps it; '' clears it.
    if (typeof body.designation === 'string') changes.designation = body.designation.trim()
    if (body.status === 'ACTIVE' || body.status === 'SUSPENDED') changes.status = body.status
    const updated = Object.keys(changes).length ? await this.accounts.update(user.id, changes) : user
    return { success: true, data: { ...item(updated), email: updated.email } }
  }

  /** Removed members are kept on record and can no longer sign in. */
  @Delete(':userId')
  async remove(@CurrentPartner() me: PartnerUser, @Param('userId') userId: string) {
    requireOwner(me)
    const user = await this.member(me, userId)
    if (user.isPrimary) throw primary()
    await this.accounts.update(user.id, { status: 'DELETED' })
    return { success: true, data: { deleted: true } }
  }
}

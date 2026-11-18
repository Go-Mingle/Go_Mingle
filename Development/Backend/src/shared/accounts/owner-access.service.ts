import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNotNull, ne, or, sql } from 'drizzle-orm'
import { apiError } from '../../common/errors'
import { today } from '../../common/time'
import { normaliseEmail } from '../../auth/passwords'
import { DB, type Db } from '../../db/database'
import { adminUsers, partnerUsers, restaurants } from '../../db/schema'
import { PartnerAccountsService, type PartnerUser } from '../../partner/access/partner-accounts.service'
import { MailService } from '../email/mail.service'
import { newRestaurantId, RestaurantsService, type Restaurant } from '../restaurants/restaurants.service'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Profile fields a partner fills in; a Draft with none of them is untouched. */
const PROFILE_FIELDS = ['name', 'cuisine', 'description', 'fullAddress', 'city', 'ownerName', 'ownerPhone', 'restaurantPhone', 'restaurantEmail', 'mainPhotoKey'] as const

/**
 * Who can sign in to which restaurant.
 *
 * One email is one partner login, and a login belongs to one restaurant. This
 * service keeps a person on the restaurant that is already theirs, so signing
 * in a new way (Google, a fresh sign-up) never opens a second, empty one:
 *
 *   - a restaurant names its owner's email in its profile. Someone who proves
 *     they hold that mailbox (Google, or the emailed code) joins that restaurant;
 *   - a GoMingle admin can create a restaurant profile for an owner, or give an
 *     email access to an existing restaurant. The owner then signs up with that
 *     email or continues with Google, and lands on that restaurant.
 */
@Injectable()
export class OwnerAccessService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly accounts: PartnerAccountsService,
    private readonly restaurants: RestaurantsService,
    private readonly mail: MailService,
  ) {}

  // ── Sign-in: keep a person on their own restaurant ─────────────────────────

  /**
   * The restaurant that names this email as its owner, when there is exactly
   * one that GoMingle knows (submitted at least once, or created by an admin).
   * Restaurants the person was removed from do not count.
   */
  async restaurantNaming(email: string, except?: string): Promise<Restaurant | 'several' | null> {
    const e = normaliseEmail(email)
    if (!e) return null
    const rows = await this.db
      .select()
      .from(restaurants)
      .where(and(sql`lower(trim(${restaurants.ownerEmail})) = ${e}`, or(isNotNull(restaurants.firstSubmittedAt), isNotNull(restaurants.invitedAt))))
    const removedFrom = new Set(
      (await this.db.select({ id: partnerUsers.restaurantId }).from(partnerUsers).where(and(eq(partnerUsers.email, e), eq(partnerUsers.status, 'DELETED')))).map((r) => r.id),
    )
    const matches = rows.filter((r) => r.id !== except && !removedFrom.has(r.id))
    if (matches.length > 1) return 'several'
    return matches[0] ?? null
  }

  /** A Draft nobody has put anything into, with this user as its only login. */
  async holdsOnlyAnEmptyDraft(user: PartnerUser): Promise<boolean> {
    const r = await this.restaurants.find(user.restaurantId)
    if (!r) return true
    if (r.status !== 'DRAFT' || r.firstSubmittedAt !== null || r.invitedAt !== null) return false
    if (PROFILE_FIELDS.some((f) => r[f] !== null && r[f] !== '')) return false
    const team = (await this.accounts.team(r.id)).filter((u) => u.status !== 'DELETED')
    return team.length === 1 && team[0].id === user.id
  }

  /** Moves a login to a restaurant. It becomes the owner login when the restaurant has none. */
  async move(user: PartnerUser, to: Restaurant): Promise<PartnerUser> {
    const hasOwner = Boolean(await this.liveOwner(to.id))
    console.log(`[owner-access] ${user.email} moved from ${user.restaurantId} to ${to.id}`)
    return this.accounts.update(user.id, { restaurantId: to.id, isPrimary: !hasOwner, designation: user.designation || 'Owner' })
  }

  /**
   * Called on every sign-in. A login sitting on an empty Draft, whose email is
   * the owner email of a real restaurant, is moved to that restaurant. This is
   * what repairs an account that was opened by mistake beside the real one.
   */
  async settle(user: PartnerUser): Promise<PartnerUser> {
    if (!(await this.holdsOnlyAnEmptyDraft(user))) return user
    const mine = await this.restaurantNaming(user.email, user.restaurantId)
    return mine && mine !== 'several' ? this.move(user, mine) : user
  }

  /**
   * The restaurant a brand-new login should join: the one naming this email as
   * owner, or a new Draft. Refuses when the email is the owner of several.
   */
  async restaurantForNewLogin(email: string): Promise<{ restaurantId: string; isPrimary: boolean; joined: Restaurant | null }> {
    const mine = await this.restaurantNaming(email)
    if (mine === 'several') {
      throw apiError(409, 'ERR_OWNER_OF_SEVERAL', 'This email is the owner contact of more than one restaurant. Contact GoMingle support to choose which one to sign in to.')
    }
    if (!mine) return { restaurantId: newRestaurantId(), isPrimary: true, joined: null }
    return { restaurantId: mine.id, isPrimary: !(await this.liveOwner(mine.id)), joined: mine }
  }

  private async liveOwner(restaurantId: string): Promise<PartnerUser | null> {
    const [row] = await this.db
      .select()
      .from(partnerUsers)
      .where(and(eq(partnerUsers.restaurantId, restaurantId), eq(partnerUsers.isPrimary, true), ne(partnerUsers.status, 'DELETED')))
    return row ?? null
  }

  // ── Admin: create a profile, give access ───────────────────────────────────

  /** Sign-in accounts of a restaurant, owners first. */
  async logins(restaurantId: string) {
    const team = (await this.accounts.team(restaurantId)).filter((u) => u.status !== 'DELETED')
    return team
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        isOwner: u.isPrimary,
        designation: u.designation || null,
        status: u.status,
        hasPassword: Boolean(u.passwordHash),
        hasGoogle: Boolean(u.googleSub),
        /** Has not set a password or used Google yet. */
        pending: !u.passwordHash && !u.googleSub,
        lastActiveAt: u.lastActiveAt,
      }))
  }

  /**
   * A GoMingle admin creates a restaurant profile with only its name and owner.
   * The owner is emailed, signs up with that email (or Google), completes the
   * profile and sends it for approval like any other restaurant.
   */
  async createProfile(admin: string, input: { name?: unknown; ownerName?: unknown; ownerEmail?: unknown; ownerPhone?: unknown }) {
    const name = text(input.name)
    const ownerName = text(input.ownerName)
    const ownerEmail = normaliseEmail(input.ownerEmail)
    const ownerPhone = text(input.ownerPhone)
    if (name.length < 2 || name.length > 120) throw invalid('name', 'Enter the restaurant name (2 to 120 characters).')
    if (ownerName.length < 2 || ownerName.length > 120) throw invalid('ownerName', "Enter the owner's name (2 to 120 characters).")
    if (!EMAIL.test(ownerEmail) || ownerEmail.length > 200) throw invalid('ownerEmail', "Enter the owner's email address.")
    if (ownerPhone && !/^\+?[0-9 ()-]{7,20}$/.test(ownerPhone)) throw invalid('ownerPhone', 'Enter a valid phone number, or leave it empty.')

    const existing = await this.checkEmail(ownerEmail)
    const waiting = await this.db
      .select({ id: restaurants.id })
      .from(restaurants)
      .where(and(sql`lower(trim(${restaurants.name})) = ${name.toLowerCase()}`, isNotNull(restaurants.invitedAt), eq(restaurants.status, 'DRAFT')))
    if (waiting.length) throw apiError(409, 'ERR_RESTAURANT_NAME_IN_USE', 'A restaurant with this name is already waiting for its owner.')

    const id = newRestaurantId()
    const [restaurant] = await this.db
      .insert(restaurants)
      .values({ id, createdAt: today(), name, ownerName, ownerEmail, ownerPhone: ownerPhone || null, invitedAt: Date.now(), invitedBy: admin })
      .returning()
    const owner = existing
      ? await this.accounts.update(existing.id, { restaurantId: id, isPrimary: true, designation: 'Owner', fullName: existing.fullName || ownerName })
      : await this.accounts.create({ email: ownerEmail, fullName: ownerName, restaurantId: id, isPrimary: true, neverActive: true })
    const emailed = await this.invite(owner, restaurant)
    return { ...this.invited(restaurant, owner), emailed }
  }

  /**
   * Gives an email a login on an existing restaurant. It is an owner login when
   * the admin asks for one, or when the restaurant has no owner yet.
   */
  async grant(restaurant: Restaurant, input: { fullName?: unknown; email?: unknown; isOwner?: unknown }) {
    const fullName = text(input.fullName)
    const email = normaliseEmail(input.email)
    if (fullName.length < 2 || fullName.length > 120) throw invalid('fullName', "Enter the person's name (2 to 120 characters).")
    if (!EMAIL.test(email) || email.length > 200) throw invalid('email', 'Enter an email address.')
    const here = (await this.accounts.team(restaurant.id)).find((u) => u.email === email)
    if (here && here.status !== 'DELETED') throw apiError(409, 'ERR_ALREADY_HAS_ACCESS', 'This email already has access to this restaurant.')

    if (input.isOwner !== undefined && typeof input.isOwner !== 'boolean') throw invalid('isOwner', 'isOwner must be true or false.')
    const existing = await this.checkEmail(email)
    const isPrimary = input.isOwner === true || !(await this.liveOwner(restaurant.id))
    let login: PartnerUser
    if (existing) {
      login = await this.accounts.update(existing.id, { restaurantId: restaurant.id, isPrimary, designation: isPrimary ? 'Owner' : existing.designation })
    } else if (here) {
      // Someone the restaurant removed earlier: bring that login back.
      login = await this.accounts.update(here.id, { status: 'ACTIVE', fullName, isPrimary, designation: isPrimary ? here.designation || 'Owner' : here.designation, failures: 0, lockedUntil: 0 })
    } else {
      login = await this.accounts.create({ email, fullName, restaurantId: restaurant.id, isPrimary, designation: isPrimary ? 'Owner' : '', neverActive: true })
    }
    const emailed = await this.invite(login, restaurant)
    return { login: (await this.logins(restaurant.id)).find((l) => l.id === login.id), moved: Boolean(existing), emailed }
  }

  /**
   * An admin changes a login: name, email, designation, role (owner or team
   * member) or status. A restaurant always keeps at least one active owner, so
   * a locked-out owner's restaurant can be handed to someone else but never
   * left with nobody in charge. Takes effect on the person's next request.
   */
  async updateLogin(restaurant: Restaurant, loginId: string, input: Record<string, unknown>) {
    const allowed = ['fullName', 'email', 'designation', 'isOwner', 'status']
    const extra = Object.keys(input).filter((k) => !allowed.includes(k))
    if (extra.length) throw invalid(extra[0], `${extra[0]} cannot be changed here.`)

    const changes: Partial<PartnerUser> = {}
    if (input.fullName !== undefined) {
      const fullName = text(input.fullName)
      if (fullName.length < 2 || fullName.length > 120) throw invalid('fullName', "Enter the person's name (2 to 120 characters).")
      changes.fullName = fullName
    }
    if (input.designation !== undefined) {
      if (typeof input.designation !== 'string' || text(input.designation).length > 100) throw invalid('designation', 'Designation can be at most 100 characters.')
      changes.designation = text(input.designation)
    }
    if (input.isOwner !== undefined && typeof input.isOwner !== 'boolean') throw invalid('isOwner', 'isOwner must be true or false.')
    if (input.status !== undefined && input.status !== 'ACTIVE' && input.status !== 'SUSPENDED') throw invalid('status', 'Status must be ACTIVE or SUSPENDED.')

    const login = await this.loginOf(restaurant.id, loginId)
    let emailChanged = false
    if (input.email !== undefined) {
      const email = normaliseEmail(input.email)
      if (!EMAIL.test(email) || email.length > 200) throw invalid('email', 'Enter an email address.')
      if (email !== login.email) {
        await this.emailFree(email, restaurant.id)
        changes.email = email
        // A Google account was linked to the old address; it must not keep signing in.
        changes.googleSub = null
        changes.failures = 0
        changes.lockedUntil = 0
        emailChanged = true
      }
    }

    const isOwner = input.isOwner === undefined ? login.isPrimary : input.isOwner
    const status = (input.status as string | undefined) ?? login.status
    if (isOwner !== login.isPrimary) {
      changes.isPrimary = isOwner
      // Keep the label in step with the role unless the admin set one.
      if (changes.designation === undefined) {
        if (isOwner && !login.designation) changes.designation = 'Owner'
        if (!isOwner && login.designation === 'Owner') changes.designation = ''
      }
    }
    if (status !== login.status) {
      changes.status = status
      if (status === 'ACTIVE') Object.assign(changes, { failures: 0, lockedUntil: 0 })
    }

    const stillLeads = isOwner && status === 'ACTIVE'
    const leadsNow = login.isPrimary && login.status === 'ACTIVE'
    await this.withOwnersLocked(restaurant.id, async (activeOwners, save) => {
      if (leadsNow && !stillLeads && activeOwners.filter((o) => o.id !== login.id).length === 0) throw lastOwner()
      if (Object.keys(changes).length) await save(login.id, changes)
    })

    const updated = (await this.logins(restaurant.id)).find((l) => l.id === login.id)
    const emailed = emailChanged ? await this.invite({ ...login, ...changes } as PartnerUser, restaurant) : false
    return { login: updated, emailed }
  }

  /** An admin takes a login's access away. Kept on record; it can be given back. */
  async removeLogin(restaurant: Restaurant, loginId: string) {
    const login = await this.loginOf(restaurant.id, loginId)
    await this.withOwnersLocked(restaurant.id, async (activeOwners, save) => {
      const leads = login.isPrimary && login.status === 'ACTIVE'
      if (leads && activeOwners.filter((o) => o.id !== login.id).length === 0) throw lastOwner()
      await save(login.id, { status: 'DELETED', isPrimary: false })
    })
    return { id: login.id, login: { id: login.id, email: login.email, fullName: login.fullName }, removed: true }
  }

  private async loginOf(restaurantId: string, loginId: string): Promise<PartnerUser> {
    const login = await this.accounts.byId(loginId)
    if (!login || login.restaurantId !== restaurantId || login.status === 'DELETED') {
      throw apiError(404, 'ERR_LOGIN_NOT_FOUND', 'This login was not found on this restaurant.')
    }
    return login
  }

  /**
   * Runs a change with the restaurant's logins locked, handing it the active
   * owners as they are inside the lock and a `save` that writes inside it, so
   * two admins changing owners at the same moment cannot leave none.
   */
  private async withOwnersLocked(
    restaurantId: string,
    change: (activeOwners: PartnerUser[], save: (id: string, values: Partial<PartnerUser>) => Promise<unknown>) => Promise<void>,
  ) {
    await this.db.transaction(async (tx) => {
      const rows = await tx.select().from(partnerUsers).where(eq(partnerUsers.restaurantId, restaurantId)).for('update')
      await change(
        rows.filter((u) => u.isPrimary && u.status === 'ACTIVE'),
        (id, values) => tx.update(partnerUsers).set(values).where(eq(partnerUsers.id, id)),
      )
    })
  }

  /** An email a login can move to: no other partner or admin account uses it, and no other restaurant names it. */
  private async emailFree(email: string, restaurantId: string) {
    const admins = await this.db.$count(adminUsers, and(eq(adminUsers.email, email), ne(adminUsers.status, 'DELETED')))
    if (admins) throw apiError(409, 'ERR_EMAIL_IS_ADMIN', 'This email belongs to a GoMingle Admin account and cannot be used for a restaurant.')
    const partner = await this.accounts.byEmail(email)
    if (partner) {
      const theirs = partner.restaurantId === restaurantId ? null : await this.restaurants.find(partner.restaurantId)
      throw apiError(
        409,
        'ERR_EMAIL_IN_USE',
        theirs?.name ? `This email already signs in to "${theirs.name}". One email can sign in to one restaurant.` : 'This email already has a login.',
      )
    }
    const named = await this.restaurantNaming(email, restaurantId)
    if (named) throw apiError(409, 'ERR_EMAIL_IN_USE', 'Another restaurant names this email as its owner. One email can sign in to one restaurant.')
  }

  /** Profiles an admin created that the owner has not sent for approval yet. */
  async invitedList() {
    const rows = await this.db
      .select()
      .from(restaurants)
      .where(and(isNotNull(restaurants.invitedAt), eq(restaurants.status, 'DRAFT'), sql`${restaurants.firstSubmittedAt} is null`))
    const out = []
    for (const r of rows.sort((a, b) => (b.invitedAt ?? 0) - (a.invitedAt ?? 0))) out.push(this.invited(r, await this.liveOwner(r.id)))
    return out
  }

  async invitedOne(id: string): Promise<Restaurant | null> {
    const r = await this.restaurants.find(id)
    return r && r.invitedAt !== null && r.status === 'DRAFT' && r.firstSubmittedAt === null ? r : null
  }

  async resend(restaurant: Restaurant) {
    const owner = await this.liveOwner(restaurant.id)
    if (!owner) throw apiError(409, 'ERR_NO_OWNER', 'This restaurant has no owner login. Give an email access first.')
    return { emailed: await this.invite(owner, restaurant) }
  }

  /**
   * Withdraws a profile the owner has not sent for approval. Its logins can no
   * longer sign in to it; the email is free to be invited or to sign up again.
   */
  async cancel(restaurant: Restaurant) {
    await this.db.update(partnerUsers).set({ status: 'DELETED' }).where(eq(partnerUsers.restaurantId, restaurant.id))
    await this.restaurants.update(restaurant.id, { invitedAt: null, invitedBy: null, ownerEmail: null })
    return { id: restaurant.id, cancelled: true }
  }

  private invited(r: Restaurant, owner: PartnerUser | null) {
    return {
      id: r.id,
      name: r.name ?? '',
      ownerName: owner?.fullName ?? r.ownerName ?? '',
      ownerEmail: owner?.email ?? r.ownerEmail ?? '',
      invitedAt: new Date(r.invitedAt ?? Date.now()).toISOString(),
      invitedBy: r.invitedBy ?? '',
      /** The owner has signed in at least once. */
      ownerSignedIn: Boolean(owner && (owner.passwordHash || owner.googleSub)),
      status: 'INVITED' as const,
    }
  }

  private async invite(login: PartnerUser, restaurant: Restaurant): Promise<boolean> {
    const sent = await this.mail.send(
      'partner_restaurant_invite',
      { email: login.email, name: login.fullName },
      { name: login.fullName, restaurantName: restaurant.name ?? 'Your restaurant', email: login.email },
    )
    return Boolean(sent)
  }

  /**
   * An email an admin wants to give a restaurant to. Returns the partner login
   * to move when the email only holds an empty Draft; throws when the email
   * belongs to an admin or to a login with a restaurant of its own.
   */
  private async checkEmail(email: string): Promise<PartnerUser | null> {
    const admins = await this.db.$count(adminUsers, and(eq(adminUsers.email, email), ne(adminUsers.status, 'DELETED')))
    if (admins) throw apiError(409, 'ERR_EMAIL_IS_ADMIN', 'This email belongs to a GoMingle Admin account and cannot be used for a restaurant.')
    const partner = await this.accounts.byEmail(email)
    if (!partner) return null
    if (await this.holdsOnlyAnEmptyDraft(partner)) return partner
    const theirs = await this.restaurants.find(partner.restaurantId)
    throw apiError(409, 'ERR_EMAIL_HAS_RESTAURANT', `This email already signs in to ${theirs?.name ? `"${theirs.name}"` : 'another restaurant'}. One email can sign in to one restaurant.`)
  }
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')
const invalid = (field: string, message: string) => apiError(422, 'ERR_VALIDATION', message, { field })
const lastOwner = () =>
  apiError(409, 'ERR_LAST_OWNER', 'A restaurant needs at least one active owner. Make someone else an owner first.')

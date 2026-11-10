import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const U = `${P}/users`

/** My Account and the Team screen; members are sign-in accounts for the same restaurant. */
describe('parity: partner account and team', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start()
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('matches the old API', async () => {
    await p.loginPartner()
    const A = { as: 'partner' }
    const login = (step: string, email: string, password: string, opts: object = {}) =>
      p.req(step, 'POST', `${P}/auth/login`, { body: { email, password }, ...opts })

    // My Account
    await p.req('me', 'GET', `${P}/me`, A)
    await p.req('me no token', 'GET', `${P}/me`)
    await p.req('me no name', 'PATCH', `${P}/me`, { ...A, body: { designation: 'Boss' } })
    await p.req('me long name', 'PATCH', `${P}/me`, { ...A, body: { fullName: 'x'.repeat(101) } })
    await p.req('me long designation', 'PATCH', `${P}/me`, { ...A, body: { fullName: 'Raees', designation: 'y'.repeat(101) } })
    await p.req('me rename', 'PATCH', `${P}/me`, { ...A, body: { fullName: '  Raees Khan ', designation: ' Founder ' } })
    await p.req('me name only', 'PATCH', `${P}/me`, { ...A, body: { fullName: 'Raees A. Khan' } })
    await p.req('me after', 'GET', `${P}/me`, A)
    // The old session always said designation Owner / isPrimary true; the new one reports the real account.
    await p.req('session follows', 'GET', `${P}/session`, { ...A, ignore: ['data.restaurant.name', 'data.partnerUser.designation'] })

    // Team: the owner is there from the start, renamed with the account
    await p.req('team', 'GET', U, A)
    await p.req('team bad dates', 'GET', `${U}?lastActiveFrom=10-11-2026`, A)
    await p.req('team inverted dates', 'GET', `${U}?lastActiveFrom=2026-11-10&lastActiveTo=2026-01-01`, A)
    await p.req('add unexpected field', 'POST', U, { ...A, body: { fullName: 'A', email: 'a@k.pk', password: 'x', confirmPassword: 'x', role: 'admin' } })
    await p.req('add no name', 'POST', U, { ...A, body: { email: 'a@k.pk', password: 'x', confirmPassword: 'x' } })
    await p.req('add no email', 'POST', U, { ...A, body: { fullName: 'A', password: 'x', confirmPassword: 'x' } })
    await p.req('add password mismatch', 'POST', U, { ...A, body: { fullName: 'A', email: 'a@k.pk', password: 'x', confirmPassword: 'y' } })
    await p.req('add owner email', 'POST', U, { ...A, body: { fullName: 'A', email: 'Partner@GoMingle.com', password: 'x', confirmPassword: 'x' } })
    const sara = await p.req('add', 'POST', U, {
      ...A,
      body: { fullName: ' Sara Aziz ', email: ' Sara@Kolachi.pk ', designation: ' Events Lead ', password: 'Sara@12345', confirmPassword: 'Sara@12345' },
    })
    expect([sara.old.status, sara.neu.status]).toEqual([201, 201])
    const saraId = sara.get('data.id')
    const bilal = await p.req('add suspended, no designation', 'POST', U, {
      ...A,
      body: { fullName: 'Bilal', email: 'bilal@kolachi.pk', status: 'SUSPENDED', password: 'Bilal@12345', confirmPassword: 'Bilal@12345' },
    })
    const bilalId = bilal.get('data.id')
    await p.req('add duplicate', 'POST', U, { ...A, body: { fullName: 'S', email: 'sara@kolachi.pk', password: 'x', confirmPassword: 'x' } })
    await p.req('team three', 'GET', U, A)
    for (const query of [
      'sortBy=name',
      'sortBy=name&sortOrder=desc',
      'sortBy=designation',
      'sortBy=status&sortOrder=desc',
      'sortBy=nope&page=9&pageSize=7',
      'pageSize=10&page=2',
      'search=LEAD',
      'search=a&searchField=name',
      'search=a&searchField=designation',
      'status=SUSPENDED',
      'status=ACTIVE,SUSPENDED',
      'status=ACTIVE&status=NOPE',
      'lastActiveFrom=2020-01-01',
      'lastActiveTo=2020-01-01',
    ]) {
      await p.req(`team ${query}`, 'GET', `${U}?${query}`, A)
    }

    // The member signs in to the same restaurant
    const saraLogin = await login('member signs in', 'sara@kolachi.pk', 'Sara@12345')
    expect([saraLogin.old.status, saraLogin.neu.status]).toEqual([200, 200])
    p.tokens.sara = saraLogin.get('accessToken')
    const S = { as: 'sara' }
    const memberSession = await p.req('member session', 'GET', `${P}/session`, { ...S, ignore: ['data.restaurant.name', 'data.partnerUser.designation', 'data.partnerUser.isPrimary'] })
    expect(memberSession.neu.json.data.partnerUser).toMatchObject({ designation: 'Events Lead', isPrimary: false })
    await p.req('member me', 'GET', `${P}/me`, S)
    await p.req('member renames herself', 'PATCH', `${P}/me`, { ...S, body: { fullName: 'Sara A.' } })
    await p.req('member sees the team', 'GET', `${U}?sortBy=name`, S)
    // Old API: a member added as Suspended could still sign in until suspended again. Fixed.
    const blocked = await login('suspended member cannot sign in', 'bilal@kolachi.pk', 'Bilal@12345', { compare: false })
    expect(blocked.neu.status).toBe(403)

    // Edit, suspend, reset password, remove
    await p.req('edit forbidden field', 'PATCH', (s) => `${U}/${saraId[s]}`, { ...A, body: { email: 'x@y.z' } })
    await p.req('edit unknown', 'PATCH', `${U}/pu-nope`, { ...A, body: { fullName: 'x' } })
    await p.req('edit', 'PATCH', (s) => `${U}/${saraId[s]}`, { ...A, body: { fullName: ' Sara Aziz ', designation: '' } })
    await p.req('edit nothing', 'PATCH', (s) => `${U}/${saraId[s]}`, { ...A, body: {} })
    await p.req('activate', 'PATCH', (s) => `${U}/${bilalId[s]}`, { ...A, body: { status: 'ACTIVE' } })
    const bilalLogin = await login('activated member signs in', 'bilal@kolachi.pk', 'Bilal@12345')
    expect([bilalLogin.old.status, bilalLogin.neu.status]).toEqual([200, 200])
    await p.req('suspend', 'PATCH', (s) => `${U}/${saraId[s]}`, { ...A, body: { status: 'SUSPENDED' } })
    await p.req('suspended member is cut off', 'GET', `${P}/me`, S)
    await p.req('unsuspend', 'PATCH', (s) => `${U}/${saraId[s]}`, { ...A, body: { status: 'ACTIVE' } })
    await p.req('set password mismatch', 'POST', (s) => `${U}/${saraId[s]}/set-password`, { ...A, body: { password: 'a', confirmPassword: 'b' } })
    await p.req('set password unknown', 'POST', `${U}/pu-nope/set-password`, { ...A, body: { password: 'a', confirmPassword: 'a' } })
    await p.req('set password', 'POST', (s) => `${U}/${saraId[s]}/set-password`, { ...A, body: { password: 'Fresh@12345', confirmPassword: 'Fresh@12345' } })
    await login('old password refused', 'sara@kolachi.pk', 'Sara@12345')
    // Old API: a rename on the Team screen did not reach the member's own account. It does now.
    const fresh = await login('new password works', 'sara@kolachi.pk', 'Fresh@12345', { ignore: ['user.fullName'] })
    expect(fresh.neu.json.user.fullName).toBe('Sara Aziz')
    expect([fresh.old.status, fresh.neu.status]).toEqual([200, 200])

    // The owner is protected
    const team = await p.req('team for owner id', 'GET', `${U}?sortBy=status`, A)
    const ownerOf = (j: any) => j.data.items.find((u: { isPrimary: boolean }) => u.isPrimary).id as string
    const ownerId = { old: ownerOf(team.old.json), neu: ownerOf(team.neu.json) }
    await p.req('suspend owner', 'PATCH', (s) => `${U}/${ownerId[s]}`, { ...A, body: { status: 'SUSPENDED' } })
    await p.req('remove owner', 'DELETE', (s) => `${U}/${ownerId[s]}`, A)
    await p.req('rename owner on the team screen', 'PATCH', (s) => `${U}/${ownerId[s]}`, { ...A, body: { fullName: 'Raees Khan', designation: 'Owner' } })

    await p.req('remove unknown', 'DELETE', `${U}/pu-nope`, A)
    await p.req('remove', 'DELETE', (s) => `${U}/${saraId[s]}`, A)
    await p.req('remove again', 'DELETE', (s) => `${U}/${saraId[s]}`, A)
    await p.req('edit removed', 'PATCH', (s) => `${U}/${saraId[s]}`, { ...A, body: { fullName: 'x' } })
    await p.req('team after removal', 'GET', U, A)
    // A removed member's session ends. (The old API answered a later sign-in attempt as "suspended";
    // the new one treats the email as unknown, the same as any address that has no account.)
    const cut = await p.req('removed member is cut off', 'GET', `${P}/me`, { ...S, compare: false })
    expect(cut.neu.status).toBeGreaterThanOrEqual(401)
    const gone = await login('removed member cannot sign in', 'sara@kolachi.pk', 'Fresh@12345', { compare: false })
    expect(gone.neu.status).toBeGreaterThanOrEqual(400)

    // Adding the same email again brings the member back, able to sign in with the new password.
    await p.req('revive', 'POST', U, { ...A, body: { fullName: 'Sara Aziz', email: 'sara@kolachi.pk', designation: 'GM', password: 'Back@12345', confirmPassword: 'Back@12345' } })
    await p.req('team end', 'GET', U, A)
    const back = await login('revived member signs in', 'sara@kolachi.pk', 'Back@12345', { compare: false })
    expect(back.neu.status).toBe(200)

    // Another restaurant's team is its own, and its emails cannot be reused here.
    await p.req('signup start', 'POST', `${P}/signup/start`, { body: { email: 'owner@bbq.pk' } })
    const verified = await p.req('signup verify', 'POST', `${P}/signup/verify`, { body: { email: 'owner@bbq.pk', code: '123456' } })
    p.tokens.bbq = verified.get('data.session.accessToken')
    await p.req('signup complete', 'POST', `${P}/signup/complete`, { as: 'bbq', body: { password: 'Bbq@12345', fullName: 'Nadia BBQ' } })
    // Old API: the owner's team row kept the name guessed from the email at sign-up.
    const other = await p.req('other team', 'GET', U, { as: 'bbq', compare: false })
    expect(other.neu.json.data.items.map((u: { fullName: string }) => u.fullName)).toEqual(['Nadia BBQ'])
    await p.req('other me', 'GET', `${P}/me`, { as: 'bbq' })
    await p.req('other cannot edit ours', 'PATCH', (s) => `${U}/${bilalId[s]}`, { as: 'bbq', body: { fullName: 'x' } })
    const taken = await p.req('email of another restaurant', 'POST', U, { as: 'bbq', compare: false, body: { fullName: 'B', email: 'bilal@kolachi.pk', password: 'x', confirmPassword: 'x' } })
    expect(taken.neu.status).toBe(409)

    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])
  }, 180_000)
})

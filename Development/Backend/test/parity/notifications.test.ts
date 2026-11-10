import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const R = `${P}/restaurant`
const N = `${P}/notifications`
const AD = '/admin/api/v1'
const AN = `${AD}/notifications`
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

/** Both inboxes, filled by what happens across the portals. */
describe('parity: notifications', () => {
  let p: Parity
  beforeAll(async () => {
    p = await Parity.start()
  })
  afterAll(async () => {
    await p?.stop()
  })

  it('matches the old API', async () => {
    await p.loginPartner()
    await p.loginAdmin()
    const A = { as: 'partner' }
    const AA = { as: 'admin' }
    const today = new Date(Date.now() + 5 * 3_600_000).toISOString().slice(0, 10)

    // Empty inboxes
    for (const path of ['', '/unread-count', '/recent', '/types']) {
      await p.req(`partner empty ${path}`, 'GET', `${N}${path}`, A)
      await p.req(`admin empty ${path}`, 'GET', `${AN}${path}`, AA)
    }
    await p.req('partner read-all empty', 'PATCH', `${N}/read-all`, A)
    await p.req('admin mark-all empty', 'PATCH', `${AN}/mark-all-read`, AA)
    await p.req('partner read unknown', 'PATCH', `${N}/n-nope/read`, A)
    await p.req('admin read unknown', 'PATCH', `${AN}/n-nope/read`, AA)
    await p.req('partner no token', 'GET', N)
    await p.req('admin no token', 'GET', AN)

    // Something to be notified about: submit → decline → resubmit → approve → category → suspend → reactivate
    await p.req('profile', 'PATCH', R, {
      ...A,
      body: {
        name: 'Kolachi',
        cuisine: 'Pakistani',
        description: 'Seafront barbecue.',
        location: { areaDistrict: 'DHA', city: 'Karachi', fullAddress: 'Do Darya, Karachi', latitude: 24.78, longitude: 67.06 },
        owner: { name: 'Raees Khan', email: 'o@kolachi.pk', phone: '+923001112233' },
        restaurant: { phone: '+922135250000', email: 'hi@kolachi.pk' },
      },
    })
    const photo = await p.req('photo target', 'POST', `${R}/photos/upload-url`, { ...A, body: { name: 'dining.jpg', contentType: 'image/jpeg' } })
    await p.req('photo put', 'PUT', (s) => photo.get('data.uploadUrl')[s], { raw: { old: JPEG, neu: JPEG }, contentType: 'image/jpeg', compare: false })
    await p.req('photo commit', 'POST', `${R}/photos`, { ...A, body: (s) => ({ uploadRef: photo.get('data.uploadRef')[s] }) })
    await p.req('payout', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: 'Kolachi', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' } })
    const cat = (await p.req('category', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 4 } })).get('id')
    const cat2 = (await p.req('category 2', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Casual', commissionRate: 8, interestTablesPerMonth: 2 } })).get('id')
    // A pause between events: inboxes order by time, to the second (partner) or minute (admin).
    const pause = () => new Promise((r) => setTimeout(r, 1100))
    const ok = async (step: string, method: string, path: string, opts: object) => {
      const r = await p.req(step, method, path, opts)
      expect([r.old.status, r.neu.status], step).toEqual([200, 200])
      await pause()
    }
    await ok('submit', 'POST', `${R}/submit`, A)
    await ok('decline', 'POST', `${AD}/admin/approvals/rest1/decline`, { ...AA, body: { reason: 'Licence is unreadable' } })
    await ok('resubmit', 'POST', `${R}/submit`, A)
    await ok('approve', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: (s: 'old' | 'neu') => ({ categoryId: cat[s] }) })
    await ok('category change', 'PATCH', `${AD}/restaurants/rest1/category`, { ...AA, body: (s: 'old' | 'neu') => ({ categoryId: cat2[s] }) })
    await ok('suspend', 'POST', `${AD}/restaurants/rest1/suspend`, { ...AA, body: { reason: 'Health inspection failed' } })
    await ok('unsuspend', 'POST', `${AD}/restaurants/rest1/unsuspend`, AA)

    // Partner inbox
    const inbox = await p.req('partner inbox', 'GET', N, A)
    expect(inbox.neu.json.data.items).toHaveLength(5)
    await p.req('partner unread', 'GET', `${N}/unread-count`, A)
    await p.req('partner recent', 'GET', `${N}/recent`, A)
    for (const query of [
      'sortDir=asc',
      'pageSize=10&page=2',
      'page=0',
      'search=SUSPENDED',
      'search=declined',
      'status=UNREAD',
      'status=READ',
      'status=ALL',
      `startDate=${today}&endDate=${today}`,
      'startDate=2020-01-01&endDate=2020-01-02',
      'type=IT_CREATED',
      'type=IT_CREATED,IT_CANCELLED&type=IT_CONFIRMED',
      // refused
      'status=unread',
      'sortDir=up',
      'pageSize=7',
      'type=RESTAURANT_APPROVED',
      `startDate=${today}`,
      `endDate=${today}`,
      'startDate=10-11-2026&endDate=11-11-2026',
      `startDate=${today}&endDate=2020-01-01`,
      `startDate=${today}&endDate=2999-01-01`,
    ]) {
      await p.req(`partner ${query}`, 'GET', `${N}?${query}`, A)
    }
    const first = inbox.get('data.items').old[0].id as string
    const firstNew = inbox.get('data.items').neu[0].id as string
    const id = { old: first, neu: firstNew }
    await p.req('partner read', 'PATCH', (s) => `${N}/${id[s]}/read`, A)
    await p.req('partner read again', 'PATCH', (s) => `${N}/${id[s]}/read`, A)
    await p.req('partner read ones', 'GET', `${N}?status=READ`, A)
    await p.req('partner unread ones', 'GET', `${N}?status=UNREAD&sortDir=asc`, A)
    await p.req('partner read all', 'PATCH', `${N}/read-all`, A)
    await p.req('partner read all again', 'PATCH', `${N}/read-all`, A)
    await p.req('partner all read', 'GET', `${N}/recent`, A)

    // Admin inbox
    const adminInbox = await p.req('admin inbox', 'GET', AN, AA)
    expect(adminInbox.neu.json.data.items).toHaveLength(2)
    await p.req('admin unread', 'GET', `${AN}/unread-count`, AA)
    await p.req('admin recent', 'GET', `${AN}/recent`, AA)
    for (const query of [
      'sortDir=asc',
      'pageSize=1&page=2',
      'search=RESUBMITTED',
      'search=kolachi',
      'type=RESTAURANT_APPLICATION_SUBMITTED',
      'type=MINGLER_SUSPENDED',
      'status=unread',
      'status=read',
      `startDate=${today}`,
      'endDate=2020-01-01',
      `startDate=${today}&endDate=${today}`,
    ]) {
      await p.req(`admin ${query}`, 'GET', `${AN}?${query}`, AA)
    }
    const aid = { old: adminInbox.old.json.data.items[1].id as string, neu: adminInbox.neu.json.data.items[1].id as string }
    await p.req('admin read', 'PATCH', (s) => `${AN}/${aid[s]}/read`, AA)
    await p.req('admin read again', 'PATCH', (s) => `${AN}/${aid[s]}/read`, AA)
    await p.req('admin read ones', 'GET', `${AN}?status=read`, AA)
    await p.req('admin unread ones', 'GET', `${AN}?status=unread`, AA)
    await p.req('admin mark all', 'PATCH', `${AN}/mark-all-read`, AA)
    await p.req('admin mark all again', 'PATCH', `${AN}/mark-all-read`, AA)
    await p.req('admin all read', 'GET', `${AN}/unread-count`, AA)

    // Another restaurant has its own inbox
    await p.req('signup start', 'POST', `${P}/signup/start`, { body: { email: 'owner@bbq.pk' } })
    const verified = await p.req('signup verify', 'POST', `${P}/signup/verify`, { body: { email: 'owner@bbq.pk', code: '123456' } })
    p.tokens.bbq = verified.get('data.session.accessToken')
    await p.req('other inbox', 'GET', N, { as: 'bbq' })
    await p.req('other cannot read ours', 'PATCH', (s) => `${N}/${id[s]}/read`, { as: 'bbq' })

    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])
  }, 180_000)
})

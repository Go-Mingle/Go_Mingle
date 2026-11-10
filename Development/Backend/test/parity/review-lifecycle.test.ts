import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type PerSide } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const R = `${P}/restaurant`
const AD = '/admin/api/v1'
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9])
const PDF = Buffer.from('%PDF-1.4 licence')

/** A valid Pakistani IBAN for a bank code and account number (ISO 13616 mod 97). */
function pkIban(bank: string, account: string): string {
  const digits = `${bank}${account}PK00`.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55))
  let rem = 0
  for (const ch of digits) rem = (rem * 10 + Number(ch)) % 97
  return `PK${String(98 - rem).padStart(2, '0')}${bank}${account}`
}

/**
 * The restaurant lifecycle across both portals: payout account, amenities,
 * submit, the approval queue, decline, resubmit, approve, the admin directory,
 * category change, suspend and reactivate.
 */
describe('parity: review lifecycle', () => {
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
    const both = (b: Buffer) => ({ old: b, neu: b })
    const upload = async (label: string, plural: string, name: string, type: string, bytes: Buffer, as = 'partner') => {
      const target = await p.req(`${label} target`, 'POST', `${R}/${plural}/upload-url`, { as, body: { name, contentType: type } })
      const urls = target.get('data.uploadUrl')
      await p.req(`${label} put`, plural === 'videos' ? 'POST' : 'PUT', (s) => urls[s], { raw: both(bytes), contentType: type, compare: false })
      const ref: PerSide<string> = target.get('data.uploadRef')
      return p.req(`${label} commit`, 'POST', `${R}/${plural}`, { as, body: (s) => ({ uploadRef: ref[s] }) })
    }

    // Catalogue: two categories to approve into
    const premium = await p.req('category premium', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 4 } })
    const casual = await p.req('category casual', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Casual', commissionRate: 8, interestTablesPerMonth: 2 } })
    const premiumId = premium.get('id')
    const casualId = casual.get('id')
    expect(premiumId.neu && premiumId.old && casualId.neu && casualId.old).toBeTruthy()
    const amenityList = await p.req('admin amenities', 'GET', `${AD}/amenities`, AA)
    const amenityId = { old: amenityList.old.json.data.items[0].id, neu: amenityList.neu.json.data.items[0].id }
    expect(amenityId.neu).toBe(amenityId.old)
    const am = amenityId.neu
    const am2 = amenityList.neu.json.data.items[3].id

    // Nothing to review yet
    await p.req('queue empty', 'GET', `${AD}/admin/approvals`, AA)
    await p.req('queue pending empty', 'GET', `${AD}/admin/approvals?status=pending`, AA)
    await p.req('directory empty', 'GET', `${AD}/restaurants`, AA)
    await p.req('draft is not an application', 'GET', `${AD}/admin/approvals/rest1`, AA)
    await p.req('draft is not in the directory', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('draft contacts', 'GET', `${AD}/restaurants/rest1/contacts`, AA)
    await p.req('draft approve', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: (s) => ({ categoryId: premiumId[s] }) })
    await p.req('draft decline', 'POST', `${AD}/admin/approvals/rest1/decline`, { ...AA, body: { reason: 'Not ready yet' } })
    await p.req('draft suspend', 'POST', `${AD}/restaurants/rest1/suspend`, { ...AA, body: { reason: 'Health inspection failed' } })
    await p.req('draft unsuspend', 'POST', `${AD}/restaurants/rest1/unsuspend`, AA)
    await p.req('unknown media', 'GET', `${AD}/restaurants/nope/media`, AA)
    await p.req('no admin token', 'GET', `${AD}/restaurants`)
    await p.req('partner token on approvals', 'GET', `${AD}/admin/approvals`, A)

    // Payout account
    await p.req('payout none', 'GET', `${R}/payout-account`, A)
    await p.req('payout no title', 'PUT', `${R}/payout-account`, { ...A, body: { bankName: 'HBL', iban: 'x' } })
    await p.req('payout bad bank', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: 'Kolachi Pvt', bankName: 'Nope', iban: 'x' } })
    await p.req('payout bad iban', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: 'Kolachi Pvt', bankName: 'HBL', iban: 'PK00HABB0000000000000000' } })
    const iban = pkIban('HABB', '0001234567890123')
    await p.req('payout save', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: ' Kolachi Pvt ', bankName: 'HBL', iban: iban.replace(/(.{4})/g, '$1 ') } })
    const saved = await p.req('payout saved', 'GET', `${R}/payout-account`, A)
    expect(saved.neu.json.data.account.ibanMasked).toBe(saved.old.json.data.account.ibanMasked)
    await p.req('payout retitle keeps number', 'PUT', `${R}/payout-account`, {
      ...A,
      body: { accountTitle: 'Kolachi Restaurants', bankName: 'Meezan Bank', iban: saved.neu.json.data.account.ibanMasked },
    })
    for (const id of ['rest1', 'nope']) {
      const page = await p.req(`payout setup page ${id}`, 'GET', `/payouts/setup/${id}`, { compare: false })
      expect(page.neu.status, id).toBe(page.old.status)
      expect(page.neu.headers.get('content-type'), id).toBe(page.old.headers.get('content-type'))
    }

    // Amenities
    await p.req('amenities', 'GET', `${R}/amenities`, A)
    await p.req('amenity bad body', 'PUT', `${R}/amenities/${am}`, { ...A, body: { selected: 'yes' } })
    await p.req('amenity unknown', 'PUT', `${R}/amenities/nope`, { ...A, body: { selected: true } })
    await p.req('amenity on', 'PUT', `${R}/amenities/${am}`, { ...A, body: { selected: true } })
    await p.req('amenity 2 on', 'PUT', `${R}/amenities/${am2}`, { ...A, body: { selected: true } })
    await p.req('amenity 2 off', 'PUT', `${R}/amenities/${am2}`, { ...A, body: { selected: false } })
    await p.req('amenities ticked', 'GET', `${R}/amenities`, A)
    await p.req('amenity unused until submitted', 'GET', `${AD}/amenities/${am}`, AA)

    // Profile, cover, documents, contacts
    await p.req('profile', 'PATCH', R, {
      ...A,
      body: {
        name: 'Kolachi',
        cuisine: 'Pakistani',
        description: 'Seafront barbecue.',
        location: { areaDistrict: 'DHA', city: 'Karachi', fullAddress: 'Do Darya, Karachi', latitude: 24.78, longitude: 67.06 },
        owner: { name: 'Raees Khan', email: 'o@kolachi.pk', phone: '+923001112233' },
        restaurant: { phone: '+922135250000', email: 'hi@kolachi.pk', website: 'kolachi.pk' },
        rules: { houseRules: 'Be kind', dressCode: 'Smart casual', servesAlcohol: false },
      },
    })
    await p.req('submit without cover', 'POST', `${R}/submit`, A)
    await upload('photo', 'photos', 'dining.jpg', 'image/jpeg', JPEG)
    await upload('photo 2', 'photos', 'bar.png', 'image/png', PNG)
    await upload('licence', 'documents', 'Trade Licence.pdf', 'application/pdf', PDF)
    await upload('floor plan', 'documents', 'Floor plan.png', 'image/png', PNG)
    await p.req('contact', 'POST', `${R}/contacts`, { ...A, body: { name: 'Sara Aziz', title: 'Events Lead' } })
    await p.req('contact 2', 'POST', `${R}/contacts`, { ...A, body: { name: 'Osama Khalil', title: 'GM', email: 'o@k.pk', phone: '+923001234567' } })
    await p.req('draft media is readable', 'GET', `${AD}/restaurants/rest1/media?kind=DOCUMENT`, AA)

    // Submit → queue
    await p.req('submit', 'POST', `${R}/submit`, A)
    await p.req('submit again', 'POST', `${R}/submit`, A)
    await p.req('session under review', 'GET', `${P}/session`, A)
    await p.req('read-only amenity', 'PUT', `${R}/amenities/${am}`, { ...A, body: { selected: false } })
    await p.req('payout editable under review', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: 'Kolachi Pvt', bankName: 'HBL', iban } })
    await p.req('queue', 'GET', `${AD}/admin/approvals`, AA)
    await p.req('queue pending', 'GET', `${AD}/admin/approvals?status=pending&pageSize=1`, AA)
    await p.req('queue rejected', 'GET', `${AD}/admin/approvals?status=rejected`, AA)
    await p.req('queue by restaurant', 'GET', `${AD}/admin/approvals?restaurant=%20KOLA`, AA)
    await p.req('queue by owner miss', 'GET', `${AD}/admin/approvals?owner=zzz`, AA)
    await p.req('queue page 2', 'GET', `${AD}/admin/approvals?page=2`, AA)
    await p.req('application', 'GET', `${AD}/admin/approvals/rest1`, AA)
    await p.req('application unknown', 'GET', `${AD}/admin/approvals/nope`, AA)
    await p.req('pending detail', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('pending not in directory', 'GET', `${AD}/restaurants`, AA)
    await p.req('pending contacts', 'GET', `${AD}/restaurants/rest1/contacts`, AA)
    await p.req('pending amenities', 'GET', `${AD}/restaurants/rest1/amenities`, AA)
    await p.req('pending tables', 'GET', `${AD}/restaurants/rest1/tables`, AA)
    await p.req('pending menu options', 'GET', `${AD}/restaurants/rest1/menu-options`, AA)
    await p.req('pending suspend', 'POST', `${AD}/restaurants/rest1/suspend`, { ...AA, body: { reason: 'Health inspection failed' } })
    await p.req('amenity in use', 'GET', `${AD}/amenities/${am}`, AA)
    for (const kind of ['DOCUMENT', 'PHOTO', 'VIDEO', 'NOPE']) await p.req(`media ${kind}`, 'GET', `${AD}/restaurants/rest1/media?kind=${kind}`, AA)
    await p.req('media default kind', 'GET', `${AD}/restaurants/rest1/media`, AA)

    // Decline → partner fixes → resubmit
    await p.req('decline no reason', 'POST', `${AD}/admin/approvals/rest1/decline`, { ...AA, body: { reason: '  ' } })
    await p.req('decline unknown', 'POST', `${AD}/admin/approvals/nope/decline`, { ...AA, body: { reason: 'x' } })
    await p.req('decline', 'POST', `${AD}/admin/approvals/rest1/decline`, { ...AA, body: { reason: ' Licence is unreadable ' } })
    await p.req('queue after decline', 'GET', `${AD}/admin/approvals?status=rejected`, AA)
    await p.req('application declined', 'GET', `${AD}/admin/approvals/rest1`, AA)
    await p.req('declined detail', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('session rejected', 'GET', `${P}/session`, A)
    await p.req('profile rejected', 'GET', R, A)
    await p.req('resubmit', 'POST', `${R}/submit`, A)
    await p.req('application resubmitted', 'GET', `${AD}/admin/approvals/rest1`, AA)
    await p.req('profile resubmitted', 'GET', R, A)

    // Approve
    await p.req('approve no category', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: {} })
    await p.req('approve bad category', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: { categoryId: 'nope' } })
    await p.req('approve unknown', 'POST', `${AD}/admin/approvals/nope/approve`, { ...AA, body: (s) => ({ categoryId: premiumId[s] }) })
    const approved = await p.req('approve', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: (s) => ({ categoryId: premiumId[s] }) })
    expect([approved.old.status, approved.neu.status]).toEqual([200, 200])
    await p.req('queue after approve', 'GET', `${AD}/admin/approvals`, AA)
    await p.req('queue pending after approve', 'GET', `${AD}/admin/approvals?status=pending`, AA)
    await p.req('session live', 'GET', `${P}/session`, A)
    await p.req('profile live', 'GET', R, A)

    // A second restaurant joins and is approved too
    await p.req('signup start', 'POST', `${P}/signup/start`, { body: { email: 'owner@bbq.pk' } })
    const verified = await p.req('signup verify', 'POST', `${P}/signup/verify`, { body: { email: 'owner@bbq.pk', code: '123456' } })
    p.tokens.bbq = verified.get('data.session.accessToken')
    const B = { as: 'bbq' }
    await p.req('signup complete', 'POST', `${P}/signup/complete`, { ...B, body: { password: 'Bbq@12345', fullName: 'Nadia BBQ' } })
    const bbqId: PerSide<string> = (await p.req('bbq session', 'GET', `${P}/session`, { ...B, ignore: ['data.restaurant.name'] })).get('data.restaurant.id')
    await p.req('bbq profile', 'PATCH', R, {
      ...B,
      body: {
        name: 'BBQ Tonight',
        cuisine: 'Barbecue',
        description: 'Grill house.',
        location: { areaDistrict: 'Clifton', city: 'Lahore', fullAddress: 'Boat Basin', latitude: 24.8, longitude: 67.03 },
        owner: { name: 'Nadia', email: 'owner@bbq.pk', phone: '+923214445566' },
        restaurant: { phone: '+923004445566', email: 'hi@bbq.pk' },
      },
    })
    await upload('bbq photo', 'photos', 'grill.jpg', 'image/jpeg', JPEG, 'bbq')
    await p.req('bbq payout', 'PUT', `${R}/payout-account`, { ...B, body: { accountTitle: 'BBQ Tonight', bankName: 'UBL', iban: pkIban('UNIL', '0009876543210987') } })
    await p.req('bbq amenity', 'PUT', `${R}/amenities/${am}`, { ...B, body: { selected: true } })
    await p.req('bbq submit', 'POST', `${R}/submit`, B)
    await p.req('queue two', 'GET', `${AD}/admin/approvals`, AA)
    await p.req('bbq approve', 'POST', (s) => `${AD}/admin/approvals/${bbqId[s]}/approve`, { ...AA, body: (s) => ({ categoryId: casualId[s] }) })

    // Directory
    const directory = await p.req('directory', 'GET', `${AD}/restaurants`, AA)
    expect(directory.neu.json.data.items).toHaveLength(2)
    for (const query of [
      'sortBy=name&sortOrder=desc',
      'sortBy=cuisine',
      'sortBy=city&sortOrder=desc',
      'sortBy=category',
      'sortBy=joinedAt',
      'sortBy=status&sortOrder=desc',
      'sortBy=bookings',
      'q=BBQ',
      'cities=lah',
      'pageSize=25&page=2',
      'pageSize=7',
      'statuses=ACTIVE',
      'statuses=ACTIVE&statuses=SUSPENDED',
      'statuses=SUSPENDED',
      'statuses=PENDING',
    ]) {
      await p.req(`directory ${query}`, 'GET', `${AD}/restaurants?${query}`, AA)
    }
    await p.req('directory by category', 'GET', (s) => `${AD}/restaurants?categoryIds=${casualId[s]}`, AA)
    await p.req('directory by categories', 'GET', (s) => `${AD}/restaurants?categoryIds=${casualId[s]}&categoryIds=${premiumId[s]}`, AA)
    await p.req('detail', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('detail bbq', 'GET', (s) => `${AD}/restaurants/${bbqId[s]}`, AA)
    await p.req('contacts', 'GET', `${AD}/restaurants/rest1/contacts`, AA)
    await p.req('amenities', 'GET', `${AD}/restaurants/rest1/amenities`, AA)
    await p.req('active bookings', 'GET', `${AD}/restaurants/rest1/bookings/count-active`, AA)
    await p.req('active bookings unknown', 'GET', `${AD}/restaurants/nope/bookings/count-active`, AA)

    // The partner edits a live profile: the admin sees it straight away
    await p.req('live edit', 'PATCH', R, { ...A, body: { cuisine: 'Seafood', visibleOnApp: false, rules: { servesAlcohol: true } } })
    await p.req('detail after edit', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('live edit back', 'PATCH', R, { ...A, body: { visibleOnApp: true } })

    // Category change
    await p.req('category unknown restaurant', 'PATCH', `${AD}/restaurants/nope/category`, { ...AA, body: (s) => ({ categoryId: casualId[s] }) })
    await p.req('category unknown', 'PATCH', `${AD}/restaurants/rest1/category`, { ...AA, body: { categoryId: 'nope' } })
    await p.req('category change', 'PATCH', `${AD}/restaurants/rest1/category`, { ...AA, body: (s) => ({ categoryId: casualId[s] }) })
    await p.req('profile new category', 'GET', R, A)
    // (The old API refreshed these counts only on the next admin change, hence here.)
    await p.req('amenity used by two', 'GET', `${AD}/amenities/${am}`, AA)
    await p.req('amenity list', 'GET', `${AD}/amenities`, AA)

    // Suspend and reactivate
    await p.req('suspend short reason', 'POST', `${AD}/restaurants/rest1/suspend`, { ...AA, body: { reason: 'short' } })
    await p.req('suspend unknown', 'POST', `${AD}/restaurants/nope/suspend`, { ...AA, body: { reason: 'Health inspection failed' } })
    await p.req('unsuspend active', 'POST', `${AD}/restaurants/rest1/unsuspend`, AA)
    const suspended = await p.req('suspend', 'POST', `${AD}/restaurants/rest1/suspend`, { ...AA, body: { reason: 'Health inspection failed' } })
    expect([suspended.old.status, suspended.neu.status]).toEqual([200, 200])
    await p.req('suspend again', 'POST', `${AD}/restaurants/rest1/suspend`, { ...AA, body: { reason: 'Health inspection failed' } })
    await p.req('suspended detail', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('directory suspended', 'GET', `${AD}/restaurants?statuses=SUSPENDED`, AA)
    await p.req('directory by status', 'GET', `${AD}/restaurants?sortBy=status`, AA)
    await p.req('profile suspended', 'GET', R, A)
    await p.req('session suspended', 'GET', `${P}/session`, A)
    await p.req('unsuspend', 'POST', `${AD}/restaurants/rest1/unsuspend`, AA)
    await p.req('reactivated detail', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('profile reactivated', 'GET', R, A)

    // Everything the admin did is in the change log.
    // Category usage: the old API never counted restaurants in a category; the new one does.
    await p.req('change log', 'GET', `${AD}/change-log`, AA)
    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])

    const list = (j: any): any[] => (Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : j?.data?.items ?? j?.items ?? [])
    const cats = await p.req('categories', 'GET', `${AD}/categories`, { ...AA, compare: false })
    expect(list(cats.neu.json).map((c: { name: string; restaurantsCount: number }) => [c.name, c.restaurantsCount]).sort()).toEqual([
      ['Casual', 2],
      ['Premium', 0],
    ])
    const del = await p.req('category in use', 'DELETE', (s) => `${AD}/categories/${casualId[s]}`, { ...AA, compare: false })
    expect(del.neu.status).toBe(409)

  }, 180_000)
})

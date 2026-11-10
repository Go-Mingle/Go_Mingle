import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type PerSide } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const R = `${P}/restaurant`
const AD = '/admin/api/v1'
const IT = `${AD}/interest-tables`
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

/** Interest tables: managed in the Admin Panel, shown to the restaurant, holding its table areas and menu options. */
describe('parity: interest tables', () => {
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

    // A live restaurant with two table areas and two menu options
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
    const courses = [{ course: 'Main Course', choose: 1, options: ['Chicken Biryani', 'Lamb Tikka'] }]
    await p.req('table area 1', 'POST', `${R}/tables`, { ...A, body: { name: 'Window Table', availability: { '5': [{ start: '18:00', end: '23:00' }] } } })
    await p.req('table area 2', 'POST', `${R}/tables`, { ...A, body: { name: 'Garden Patio' } })
    await p.req('menu option 1', 'POST', `${R}/menu-options`, { ...A, body: { name: 'Signature Set', pricePkr: 3500, courses } })
    await p.req('menu option 2', 'POST', `${R}/menu-options`, { ...A, body: { name: 'Seafood Set', pricePkr: 4200, courses } })

    const body = (extra: object = {}) => ({
      name: 'Startup Mixer',
      maxGuests: 8,
      startDate: '2027-03-12',
      startTime: '19:30',
      durationMinutes: 150,
      availabilityMode: 'AVAILABLE_NOW',
      publish: true,
      ...extra,
    })
    await p.req('create for a draft restaurant', 'POST', `${AD}/restaurants/rest1/interest-tables`, { ...AA, body: body() })
    await p.req('create for unknown restaurant', 'POST', `${AD}/restaurants/nope/interest-tables`, { ...AA, body: body() })

    const submitted = await p.req('submit', 'POST', `${R}/submit`, A)
    const cat = (await p.req('category', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 4 } })).get('id')
    const approved = await p.req('approve', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: (s) => ({ categoryId: cat[s] }) })
    expect([submitted.old.status, approved.old.status, submitted.neu.status, approved.neu.status]).toEqual([200, 200, 200, 200])
    const topics = await p.req('topics', 'GET', `${AD}/topics`, { ...AA, compare: false })
    const topicsOf = (j: any): { id: string }[] => j?.data?.items ?? j?.items ?? j?.data ?? j
    const topic = { old: topicsOf(topics.old.json)[0].id, neu: topicsOf(topics.neu.json)[0].id }
    const topic2 = { old: topicsOf(topics.old.json)[1].id, neu: topicsOf(topics.neu.json)[1].id }
    expect(topic.neu).toBeTruthy()

    // Empty
    await p.req('master empty', 'GET', IT, AA)
    await p.req('restaurant list empty', 'GET', `${AD}/restaurants/rest1/interest-tables`, AA)
    await p.req('lookup empty', 'GET', `${AD}/restaurants/rest1/lookups/interest-tables`, AA)
    await p.req('partner empty', 'GET', `${P}/interest-tables`, A)
    await p.req('get unknown', 'GET', `${IT}/nope`, AA)
    for (const action of ['publish', 'cancel', 'make-available', 'promingler']) await p.req(`${action} unknown`, 'POST', `${IT}/nope/${action}`, { ...AA, body: {} })
    await p.req('patch unknown', 'PATCH', `${IT}/nope`, { ...AA, body: { name: 'x' } })
    await p.req('delete unknown', 'DELETE', `${IT}/nope`, AA)
    await p.req('invitees unknown', 'GET', `${IT}/nope/invitees`, AA)
    await p.req('menu options unknown', 'GET', `${IT}/nope/menu-options`, AA)
    await p.req('availability check', 'GET', `${AD}/restaurants/rest1/tables/t-1/availability-check`, AA)

    // Create: live now, coming soon, draft
    const create = async (step: string, extra: object | ((s: 'old' | 'neu') => object)) => {
      const r = await p.req(step, 'POST', `${AD}/restaurants/rest1/interest-tables`, {
        ...AA,
        body: (s) => body(typeof extra === 'function' ? extra(s) : extra),
      })
      expect([r.old.status, r.neu.status], step).toEqual([201, 201])
      await new Promise((res) => setTimeout(res, 5))
      return r.get('data.id') as PerSide<string>
    }
    const mixer = await create('create', (s) => ({ topicId: topic[s], restaurantTableId: 't-1', menuOptionIds: ['c-1', 'c-2'], inviteOnly: true }))
    const wine = await create('create coming soon', (s) => ({
      name: 'Friday Wine Evening',
      availabilityMode: 'COMING_SOON',
      startDate: '2027-01-05',
      maxGuests: 12,
      topicId: topic2[s],
      restaurantTableId: 't-2',
      menuOptionIds: ['c-2'],
      prominglerEnabled: true,
      prominglerMinglerId: 'm-nobody',
    }))
    const draft = await create('create draft', { name: 'Book Club', publish: false, startDate: '2027-02-01', restaurantTableId: 't-9' })
    const at = (ids: PerSide<string>, suffix = '') => (s: 'old' | 'neu') => `${IT}/${ids[s]}${suffix}`

    await p.req('get', 'GET', at(mixer), AA)
    await p.req('get coming soon', 'GET', at(wine), AA)
    await p.req('get draft', 'GET', at(draft), AA)
    await p.req('menu options', 'GET', at(mixer, '/menu-options'), AA)
    await p.req('menu options none', 'GET', at(draft, '/menu-options'), AA)

    // Lists
    await p.req('master', 'GET', IT, AA)
    for (const query of [
      'sortBy=interestTable&sortOrder=asc',
      'sortBy=restaurant',
      'sortBy=maxGuests&sortOrder=asc',
      'sortBy=dateTime&sortOrder=asc',
      'sortBy=nope&pageSize=7&page=0',
      'pageSize=10&page=2',
      'search=wine',
      'search=KOLA&searchField=restaurant',
      'search=KOLA&searchField=interestTable',
      'availabilityMode=COMING_SOON',
      'availabilityMode=COMING_SOON,AVAILABLE_NOW&status=DRAFT&status=PENDING',
      'status=CANCELLED',
      'restaurantId=rest1',
      'restaurantId=nope',
      'inviteOnly=true',
      'inviteOnly=false',
      'inviteOnly=maybe',
      `search=${'x'.repeat(101)}`,
    ]) {
      await p.req(`master ${query.slice(0, 60)}`, 'GET', `${IT}?${query}`, AA)
    }
    for (const query of ['', 'q=MIX', 'status=DRAFT', 'sortBy=name', 'sortBy=name&sortOrder=DESC', 'sortBy=status', 'sortBy=seatsBooked', 'sortOrder=DESC', 'pageSize=25&page=2']) {
      await p.req(`restaurant list ${query}`, 'GET', `${AD}/restaurants/rest1/interest-tables?${query}`, AA)
    }
    await p.req('lookup', 'GET', `${AD}/restaurants/rest1/lookups/interest-tables`, AA)
    await p.req('topic counts', 'GET', `${AD}/topics`, AA)

    // The restaurant sees live tables only
    await p.req('partner list', 'GET', `${P}/interest-tables`, A)
    await p.req('partner list coming soon', 'GET', `${P}/interest-tables?status=COMING_SOON`, A)
    await p.req('partner list page', 'GET', `${P}/interest-tables?page=2&pageSize=1`, A)
    await p.req('partner detail', 'GET', (s) => `${P}/interest-tables/${mixer[s]}`, A)
    await p.req('partner detail coming soon', 'GET', (s) => `${P}/interest-tables/${wine[s]}`, A)
    await p.req('partner detail draft hidden', 'GET', (s) => `${P}/interest-tables/${draft[s]}`, A)
    await p.req('partner menu options', 'GET', (s) => `${P}/interest-tables/${mixer[s]}/menu-options`, A)
    await p.req('partner bookings', 'GET', (s) => `${P}/interest-tables/${mixer[s]}/bookings`, A)
    await p.req('partner invitees', 'GET', (s) => `${P}/interest-tables/${mixer[s]}/invitees`, A)
    await p.req('partner invitees open table', 'GET', (s) => `${P}/interest-tables/${wine[s]}/invitees`, A)
    await p.req('partner invitees draft', 'GET', (s) => `${P}/interest-tables/${draft[s]}/invitees`, A)
    await p.req('partner cancel invite', 'POST', (s) => `${P}/interest-tables/${mixer[s]}/invitees/inv-1/cancel`, A)
    await p.req('partner booking', 'GET', `${P}/bookings/b-1`, A)
    await p.req('partner cancel booking', 'POST', `${P}/bookings/b-1/cancel`, A)
    await p.req('partner mingler', 'GET', `${P}/minglers/m-1`, A)

    // In use: the restaurant cannot delete what an upcoming table holds
    await p.req('area in use', 'DELETE', `${R}/tables/t-1`, A)
    await p.req('option in use by two', 'DELETE', `${R}/menu-options/c-2`, A)
    await p.req('hide option', 'PATCH', `${R}/menu-options/c-2/visibility`, { ...A, body: { hidden: true } })
    await p.req('hidden option not offered', 'GET', at(mixer, '/menu-options'), AA)
    // The old partner side only caught up on the next admin change; the new one reads the same rows as the admin.
    const offered = await p.req('hidden option not offered to partner', 'GET', (s) => `${P}/interest-tables/${mixer[s]}/menu-options`, { ...A, compare: false })
    expect(offered.neu.json.data.items.map((o: { name: string }) => o.name)).toEqual(['Signature Set'])

    // Edit and lifecycle
    await p.req('edit', 'PATCH', at(mixer), {
      ...AA,
      body: (s) => ({ name: 'Founders Mixer', maxGuests: 10, startDate: '2027-03-13', startTime: '20:00', durationMinutes: 90, inviteOnly: false, menuOptionIds: ['c-1'], topicId: topic2[s] }),
    })
    await p.req('edit table area only', 'PATCH', at(mixer), { ...AA, body: { restaurantTableId: 't-2', coverImageKey: null } })
    await p.req('edit nothing', 'PATCH', at(mixer), { ...AA, body: {} })
    await p.req('partner detail after edit', 'GET', (s) => `${P}/interest-tables/${mixer[s]}`, A)
    await p.req('area released', 'DELETE', `${R}/tables/t-1`, A)
    await p.req('publish draft', 'POST', at(draft, '/publish'), AA)
    await p.req('make available', 'POST', at(wine, '/make-available'), AA)
    await p.req('promingler missing', 'POST', at(mixer, '/promingler'), { ...AA, body: {} })
    await p.req('promingler', 'POST', at(mixer, '/promingler'), { ...AA, body: { prominglerMinglerId: 'm-nobody' } })
    await p.req('invitees', 'GET', at(mixer, '/invitees'), AA)
    await p.req('invite unknown mingler', 'POST', at(mixer, '/invitees'), { ...AA, body: { minglerId: 'm-nobody' } })
    await p.req('uninvite nobody', 'DELETE', at(mixer, '/invitees/m-nobody'), AA)
    await p.req('cancel', 'POST', at(wine, '/cancel'), AA)
    await p.req('partner list after cancel', 'GET', `${P}/interest-tables`, A)
    await p.req('partner cancelled detail', 'GET', (s) => `${P}/interest-tables/${wine[s]}`, A)
    await p.req('option released by cancel', 'DELETE', `${R}/menu-options/c-2`, A)
    await p.req('topic counts after cancel', 'GET', `${AD}/topics`, AA)
    await p.req('delete', 'DELETE', at(draft), AA)
    await p.req('delete again', 'DELETE', at(draft), AA)
    await p.req('master end', 'GET', `${IT}?sortBy=interestTable&sortOrder=asc`, AA)
    await p.req('change log', 'GET', `${AD}/change-log`, AA)

    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])
  }, 180_000)
})

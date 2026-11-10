import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity, type PerSide } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const R = `${P}/restaurant`
const AD = '/admin/api/v1'
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 9, 9])
const PDF = Buffer.from('%PDF-1.4 menu')

/** Table areas, weekly availability, menu options and the menu PDF, and how the Admin Panel sees them. */
describe('parity: tables and menu', () => {
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

    // ── Tables ──────────────────────────────────────────────────────────────
    const T = `${R}/tables`
    await p.req('tables empty', 'GET', T, A)
    await p.req('table no name', 'POST', T, { ...A, body: {} })
    await p.req('table unknown field', 'POST', T, { ...A, body: { name: 'X', seats: 4 } })
    await p.req('table long name', 'POST', T, { ...A, body: { name: 'x'.repeat(151) } })
    await p.req('table availability not object', 'POST', T, { ...A, body: { name: 'X', availability: [] } })
    await p.req('table bad days and ranges', 'POST', T, {
      ...A,
      body: {
        name: 'X',
        availability: {
          '7': [],
          mon: [],
          '1': 'closed',
          '2': Array.from({ length: 7 }, (_, i) => ({ start: `0${i}:00`, end: `0${i}:30` })),
          '3': [{ start: '9:00', end: '25:00' }, { start: '22:00', end: '01:00' }, { start: '10:00', end: '10:00' }],
          '4': [{ start: '10:00', end: '12:00' }, { start: '11:59', end: '13:00' }],
          '5': [{ start: '10:00', end: '12:00' }, { start: '12:00', end: '13:00' }],
        },
      },
    })
    const window = await p.req('table', 'POST', T, {
      ...A,
      body: { name: '  Window Table ', availability: { '1': [{ start: '16:00', end: '17:00' }, { start: '10:00', end: '11:30' }], '0': [{ start: '00:00', end: '23:59' }] } },
    })
    expect(window.neu.json.data.tableId).toBe(window.old.json.data.tableId)
    await p.req('table duplicate', 'POST', T, { ...A, body: { name: 'window table' } })
    await p.req('table 2', 'POST', T, { ...A, body: { name: 'Garden Patio', availability: { '5': [{ start: '18:00', end: '23:00' }] } } })
    await p.req('table 3 always closed', 'POST', T, { ...A, body: { name: "Chef's Counter" } })
    await p.req('tables', 'GET', T, A)
    await p.req('table update missing', 'PATCH', `${T}/t-9`, { ...A, body: { name: 'x' } })
    await p.req('table update invalid', 'PATCH', `${T}/t-1`, { ...A, body: { availability: {} } })
    await p.req('table update duplicate', 'PATCH', `${T}/t-1`, { ...A, body: { name: 'GARDEN PATIO' } })
    await p.req('table update own name', 'PATCH', `${T}/t-1`, { ...A, body: { name: 'Window Table', availability: { '6': [{ start: '12:00', end: '15:00' }] } } })
    await p.req('table hide bad body', 'PATCH', `${T}/t-2/visibility`, { ...A, body: { hidden: 'yes' } })
    await p.req('table hide missing', 'PATCH', `${T}/t-9/visibility`, { ...A, body: { hidden: true } })
    await p.req('table hide', 'PATCH', `${T}/t-2/visibility`, { ...A, body: { hidden: true } })
    await p.req('table hide again', 'PATCH', `${T}/t-2/visibility`, { ...A, body: { hidden: true } })
    await p.req('table delete missing', 'DELETE', `${T}/t-9`, A)
    await p.req('table delete', 'DELETE', `${T}/t-3`, A)
    await p.req('table delete again', 'DELETE', `${T}/t-3`, A)
    const t4 = await p.req('table 4 gets a new id', 'POST', T, { ...A, body: { name: "Chef's Counter", availability: { '3': [{ start: '20:00', end: '23:00' }] } } })
    expect(t4.neu.json.data.tableId).toBe(t4.old.json.data.tableId)
    await p.req('tables end', 'GET', T, A)

    // ── Menu options ────────────────────────────────────────────────────────
    const M = `${R}/menu-options`
    const courses = [
      { course: 'Main Course', choose: 1, options: ['Chicken Biryani', 'Lamb Tikka'] },
      { course: 'Desserts', choose: 2, options: ['Kunafa', 'Baklava', 'Kheer'] },
    ]
    await p.req('options empty', 'GET', M, A)
    await p.req('option empty body', 'POST', M, { ...A, body: {} })
    await p.req('option invalid', 'POST', M, {
      ...A,
      body: { name: 'x'.repeat(256), pricePkr: -1, courses: [{ course: ' ', choose: 0, options: [] }, { course: 'A', choose: 3, options: ['one'] }, { course: 'B', choose: 1.5, options: ['one'] }] },
    })
    await p.req('option price not a number', 'POST', M, { ...A, body: { name: 'Set', pricePkr: '100', courses: [] } })
    await p.req('option too many sections', 'POST', M, { ...A, body: { name: 'Set', pricePkr: 1, courses: Array.from({ length: 21 }, () => courses[0]) } })
    const combo = await p.req('option', 'POST', M, { ...A, body: { name: ' Signature Set ', pricePkr: 3500.5, courses, extra: 'ignored' } })
    expect(combo.neu.json.data.comboId).toBe(combo.old.json.data.comboId)
    await p.req('option 2', 'POST', M, { ...A, body: { name: 'Seafood Set', pricePkr: 0, courses: [courses[0]] } })
    await p.req('options', 'GET', M, A)
    await p.req('option update missing', 'PATCH', `${M}/c-9`, { ...A, body: { name: 'x', pricePkr: 1, courses } })
    await p.req('option update invalid', 'PATCH', `${M}/c-1`, { ...A, body: { name: 'x' } })
    await p.req('option update', 'PATCH', `${M}/c-1`, { ...A, body: { name: 'Signature Levantine', pricePkr: 4200, courses: [courses[1]] } })
    await p.req('option hide bad body', 'PATCH', `${M}/c-2/visibility`, { ...A, body: {} })
    await p.req('option hide missing', 'PATCH', `${M}/c-9/visibility`, { ...A, body: { hidden: true } })
    await p.req('option hide', 'PATCH', `${M}/c-2/visibility`, { ...A, body: { hidden: true } })
    await p.req('option delete missing', 'DELETE', `${M}/c-9`, A)

    // ── Menu PDF ────────────────────────────────────────────────────────────
    const stage = async (label: string, name: string, bytes: Buffer | null) => {
      const target = await p.req(`${label} target`, 'POST', `${R}/menu-pdf/upload-url`, { ...A, body: { name, contentType: 'application/pdf' } })
      expect(target.neu.json.data.uploadRef, label).toBe(target.old.json.data.uploadRef)
      const urls = target.get('data.uploadUrl')
      if (bytes) {
        const put = await p.req(`${label} put`, 'PUT', (s) => urls[s], { raw: both(bytes), contentType: 'application/pdf', compare: false })
        expect([put.old.status, put.neu.status], label).toEqual([200, 200])
      }
      return target.get('data.uploadRef') as PerSide<string>
    }
    const commit = (label: string, ref: PerSide<string>) => p.req(`${label} commit`, 'PUT', `${R}/menu-pdf`, { ...A, body: (s) => ({ uploadRef: ref[s] }) })

    await p.req('pdf none', 'GET', `${R}/menu-pdf`, A)
    await p.req('pdf delete none', 'DELETE', `${R}/menu-pdf`, A)
    await p.req('pdf target not a pdf', 'POST', `${R}/menu-pdf/upload-url`, { ...A, body: { name: 'menu.png', contentType: 'image/png' } })
    await p.req('pdf target no name', 'POST', `${R}/menu-pdf/upload-url`, { ...A, body: { contentType: 'application/pdf' } })
    await p.req('pdf commit unknown', 'PUT', `${R}/menu-pdf`, { ...A, body: { uploadRef: 'mu-99' } })
    await p.req('pdf commit no ref', 'PUT', `${R}/menu-pdf`, { ...A, body: {} })
    const unknownPut = await p.req('pdf put unknown ref', 'PUT', (s) => `${p.base(s)}/t/rest1/mock-menu-upload/mu-99`, { raw: both(PDF), contentType: 'application/pdf', compare: false })
    expect([unknownPut.old.status, unknownPut.neu.status]).toEqual([403, 403])
    await commit('pdf never uploaded', await stage('pdf never uploaded', 'a.pdf', null))
    await commit('pdf wrong bytes', await stage('pdf wrong bytes', 'b.pdf', PNG))
    await commit('pdf empty', await stage('pdf empty', 'c.pdf', Buffer.alloc(0)))
    const ref = await stage('pdf', 'Autumn Menu 2026 (final).PDF', PDF)
    const committed = await commit('pdf', ref)
    expect(committed.neu.json.data.name).toBe('autumn-menu-2026-final.pdf')
    await commit('pdf again', ref)
    const served = await p.req('pdf served', 'GET', (s) => committed.get('data.menuUrl')[s], { compare: false })
    expect(served.neu.text).toBe(served.old.text)
    expect(served.neu.headers.get('content-type')).toBe(served.old.headers.get('content-type'))
    expect(served.neu.headers.get('cache-control')).toBe(served.old.headers.get('cache-control'))
    await p.req('pdf', 'GET', `${R}/menu-pdf`, A)
    const replaced = await commit('pdf replace', await stage('pdf replace', '....pdf', PDF))
    expect(replaced.neu.json.data.name).toBe(replaced.old.json.data.name)
    // Menu ids and upload refs share one running number per restaurant.
    const c3 = await p.req('option 3', 'POST', M, { ...A, body: { name: 'Tasting', pricePkr: 9000, courses } })
    expect(c3.neu.json.data.comboId).toBe(c3.old.json.data.comboId)
    await p.req('option delete', 'DELETE', (s) => `${M}/${c3.get('data.comboId')[s]}`, A)

    // ── Under review: everything is read-only; then the admin sees it ───────
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
    await p.req('photo put', 'PUT', (s) => photo.get('data.uploadUrl')[s], { raw: both(JPEG), contentType: 'image/jpeg', compare: false })
    await p.req('photo commit', 'POST', `${R}/photos`, { ...A, body: (s) => ({ uploadRef: photo.get('data.uploadRef')[s] }) })
    await p.req('payout', 'PUT', `${R}/payout-account`, { ...A, body: { accountTitle: 'Kolachi', bankName: 'HBL', iban: 'PK36SCBL0000001123456702' } })
    const submitted = await p.req('submit', 'POST', `${R}/submit`, A)
    expect([submitted.old.status, submitted.neu.status]).toEqual([200, 200])

    await p.req('ro tables readable', 'GET', T, A)
    await p.req('ro table create', 'POST', T, { ...A, body: { name: 'New' } })
    await p.req('ro table update', 'PATCH', `${T}/t-1`, { ...A, body: { name: 'New' } })
    await p.req('ro table hide', 'PATCH', `${T}/t-1/visibility`, { ...A, body: { hidden: true } })
    await p.req('ro table delete', 'DELETE', `${T}/t-1`, A)
    await p.req('ro option create', 'POST', M, { ...A, body: {} })
    await p.req('ro option update', 'PATCH', `${M}/c-1`, { ...A, body: {} })
    await p.req('ro option hide', 'PATCH', `${M}/c-1/visibility`, { ...A, body: { hidden: true } })
    await p.req('ro option delete', 'DELETE', `${M}/c-1`, A)
    await p.req('ro pdf target', 'POST', `${R}/menu-pdf/upload-url`, { ...A, body: { name: 'a.pdf', contentType: 'application/pdf' } })
    await p.req('ro pdf commit', 'PUT', `${R}/menu-pdf`, { ...A, body: { uploadRef: 'mu-1' } })
    await p.req('ro pdf delete', 'DELETE', `${R}/menu-pdf`, A)

    await p.req('admin tables', 'GET', `${AD}/restaurants/rest1/tables`, AA)
    await p.req('admin menu options', 'GET', `${AD}/restaurants/rest1/menu-options`, AA)
    await p.req('admin detail has the menu', 'GET', `${AD}/restaurants/rest1`, AA)
    await p.req('admin tables unknown', 'GET', `${AD}/restaurants/nope/tables`, AA)

    // Live again: removing the PDF shows on the admin side too
    const category = await p.req('category', 'POST', `${AD}/categories`, { ...AA, body: { name: 'Premium', commissionRate: 12, interestTablesPerMonth: 4 } })
    const approved = await p.req('approve', 'POST', `${AD}/admin/approvals/rest1/approve`, { ...AA, body: (s) => ({ categoryId: category.get('id')[s] }) })
    expect([approved.old.status, approved.neu.status]).toEqual([200, 200])
    await p.req('pdf delete', 'DELETE', `${R}/menu-pdf`, A)
    await p.req('pdf gone', 'GET', `${R}/menu-pdf`, A)
    await p.req('table show', 'PATCH', `${T}/t-2/visibility`, { ...A, body: { hidden: false } })
    await p.req('admin tables after', 'GET', `${AD}/restaurants/rest1/tables`, AA)
    await p.req('admin detail no menu', 'GET', `${AD}/restaurants/rest1`, AA)

    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])
  }, 180_000)
})

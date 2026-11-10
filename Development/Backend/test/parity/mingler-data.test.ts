import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Parity } from '../helpers/parity'

const P = '/partner/api/v1/partner'
const AD = '/admin/api/v1'
const W = `${P}/webhook`

/**
 * Screens fed by the Mingler app (minglers, bookings, reviews, finances): empty
 * until that app exists, with the validation the screens rely on. Plus the
 * partner's webhook settings, which are real.
 */
describe('parity: mingler-app data and integrations', () => {
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
    const get = (path: string, as = AA) => p.req(`GET ${path.slice(0, 70)}`, 'GET', path, as)
    const send = (method: string, path: string, body: object = {}, as = AA) => p.req(`${method} ${path.slice(0, 70)}`, method, path, { ...as, body })

    // Minglers
    await get(`${AD}/minglers`)
    await get(`${AD}/minglers?page=3&pageSize=50&sortBy=name&sortOrder=asc&name=sa&statuses=ACTIVE&joinedFrom=2026-01-01`)
    await get(`${AD}/minglers/prominglers/active`)
    await get(`${AD}/minglers/m1`)
    await get(`${AD}/minglers/m1/bookings`)
    await get(`${AD}/minglers/m1/bookings/count-active`)
    await get(`${AD}/minglers/m1/eating-preferences`)
    await get(`${AD}/minglers/m1/payment-methods`)
    await send('POST', `${AD}/minglers/m1/suspend`, { reason: 'Repeated no-shows' })
    await send('POST', `${AD}/minglers/m1/reactivate`)
    await send('PATCH', `${AD}/minglers/m1/promingler`, { isPromingler: true })
    await send('POST', `${AD}/minglers/m1/payment-methods/pm1/set-default`)
    await p.req('minglers no token', 'GET', `${AD}/minglers`)

    // Bookings
    await get(`${AD}/admin/bookings`)
    await get(`${AD}/admin/bookings?minglerId=m1`)
    await get(`${AD}/admin/bookings?interestTableId=it1&status=PENDING,CONFIRMED&page=2&pageSize=25&sortBy=status&sortOrder=asc`)
    await get(`${AD}/admin/bookings/b1`)
    await send('POST', `${AD}/admin/bookings/b1/cancel`)

    // Reviews
    await get(`${AD}/restaurants/rest1/reviews`)
    await get(`${AD}/restaurants/rest1/reviews?q=good&ratingFilter=5,4&page=2&pageSize=25&sortBy=rating&sortOrder=asc`)
    await get(`${AD}/admin/reviews?minglerId=m1`)
    await get(`${AD}/admin/reviews?page=2&pageSize=5`)
    await get(`${AD}/reviews/r1`)
    await p.req('delete review', 'DELETE', `${AD}/reviews/r1`, AA)

    // Finances
    await get(`${AD}/admin/finances`)
    await get(`${AD}/admin/finances?page=2&pageSize=50&sortBy=total&sortOrder=asc&restaurant=kol&dateFrom=2026-01-01&dateTo=2026-12-31`)
    await get(`${AD}/admin/finances?dateFrom=2026-12-31&dateTo=2026-01-01`)
    await get(`${AD}/admin/finances/export`)
    await get(`${AD}/admin/finances/BK-1`)
    await get('/admin/api/timer-settings')

    // Partner: reviews and finance ledger
    await get(`${P}/reviews`, A)
    await get(`${P}/reviews?search=x&ratingFilter=5&ratingFilter=1,2&sortBy=rating&sortOrder=asc&page=4&pageSize=25`, A)
    await get(`${P}/reviews?pageSize=7&page=-1`, A)
    await get(`${P}/reviews/r-1`, A)
    await p.req('partner reviews no token', 'GET', `${P}/reviews`)
    await get(`${P}/finances`, A)
    for (const query of [
      'pageSize=25&page=3&sortBy=mingler&sortOrder=asc&searchField=bookingRef&search=BK',
      'period=THIS_MONTH',
      'period=CUSTOM&dateFrom=2026-01-01&dateTo=2026-02-01',
      'restaurantId=rest2',
      'sortBy=total',
      'sortOrder=up',
      'searchField=restaurant',
      'period=LAST_WEEK',
      'period=THIS_YEAR&dateFrom=2026-01-01',
      'period=CUSTOM&dateFrom=2026-01-01',
      'dateFrom=01-01-2026',
      'dateTo=2026/01/01',
      'dateFrom=2026-02-01&dateTo=2026-01-01',
      'page=0',
      'page=1.5',
      'pageSize=7',
    ]) {
      await get(`${P}/finances?${query}`, A)
    }
    await get(`${P}/finances/b-1`, A)
    for (const query of ['', 'period=ALL_TIME&sortBy=date', 'page=1', 'pageSize=10', 'sortBy=nope', 'restaurantId=x']) {
      const csv = await p.req(`export ${query}`, 'GET', `${P}/finances/export?${query}`, { ...A, compare: false })
      expect(csv.neu.status, query).toBe(csv.old.status)
      if (csv.neu.status === 200) {
        expect(csv.neu.text).toBe(csv.old.text)
        expect(csv.neu.headers.get('content-type')).toBe(csv.old.headers.get('content-type'))
        expect(csv.neu.headers.get('content-disposition')).toMatch(/^attachment; filename="finances-\d{4}-\d{2}-\d{2}-\d{4}\.csv"$/)
      } else {
        expect(csv.neu.json).toEqual(csv.old.json)
      }
    }

    // Partner: webhook settings (secrets are random, so they are compared by shape)
    const secrets = ['data.signingSecret', 'data.signingSecretMasked']
    await get(W, A)
    await get(`${W}?reveal=true`, A)
    await get(`${W}/deliveries`, A)
    await send('POST', `${W}/rotate-secret`, {}, A)
    await send('POST', `${W}/test`, { eventType: 'BOOKING_CREATED' }, A)
    await send('PUT', W, { endpointUrl: 'https://api.kolachi.pk/hooks', bearerToken: 't', signingSecret: 'mine' }, A)
    await send('PUT', W, { endpointUrl: 'http://api.kolachi.pk/hooks', bearerToken: 't' }, A)
    await send('PUT', W, { endpointUrl: 'not a url', bearerToken: 't' }, A)
    await send('PUT', W, { endpointUrl: 'https://localhost/hooks', bearerToken: 't' }, A)
    await send('PUT', W, { endpointUrl: 'https://api.kolachi.pk/hooks', bearerToken: '  ' }, A)
    await send('PUT', W, { endpointUrl: 'https://api.kolachi.pk/hooks', bearerToken: 'x'.repeat(501) }, A)
    const saved = await p.req('webhook save', 'PUT', W, { ...A, ignore: secrets, body: { endpointUrl: ' https://api.kolachi.pk/hooks ', bearerToken: ' pos_live_123 ', enabled: true } })
    expect(saved.neu.status).toBe(200)
    for (const side of [saved.old, saved.neu]) {
      expect(side.json.data.signingSecret).toMatch(/^whsec_[0-9a-f]{32}$/)
      expect(side.json.data.signingSecretMasked).toBe(`whsec_••••${side.json.data.signingSecret.slice(-4)}`)
    }
    await p.req('webhook after save', 'GET', W, { ...A, ignore: secrets })
    await p.req('webhook revealed', 'GET', `${W}?reveal=true`, { ...A, ignore: secrets })
    await p.req('webhook reveal must be literal', 'GET', `${W}?reveal=1`, { ...A, ignore: secrets })
    const again = await p.req('webhook save again keeps the secret', 'PUT', W, { ...A, ignore: secrets, body: { endpointUrl: 'https://10.0.0.5/hooks', bearerToken: 'pos_live_456' } })
    expect(again.neu.json.data.signingSecret).toBeNull()
    expect(again.neu.json.data.signingSecretMasked).toBe(saved.neu.json.data.signingSecretMasked)
    const rotated = await p.req('webhook rotate', 'POST', `${W}/rotate-secret`, { ...A, ignore: secrets })
    expect(rotated.neu.json.data.signingSecret).toMatch(/^whsec_[0-9a-f]{32}$/)
    expect(rotated.neu.json.data.signingSecret).not.toBe(saved.neu.json.data.signingSecret)
    await p.req('webhook after rotate', 'GET', W, { ...A, ignore: secrets })
    await send('POST', `${W}/test`, { eventType: 'NOPE' }, A)
    await send('POST', `${W}/test`, { eventType: 'INTEREST_TABLE_PUBLISHED' }, A)
    await get(`${W}/deliveries?status=DELIVERED`, A) // a test shows up a few seconds later
    await new Promise((r) => setTimeout(r, 4200))
    await send('POST', `${W}/test`, { eventType: 'BOOKING_CANCELLED' }, A)
    await new Promise((r) => setTimeout(r, 4200))
    for (const query of ['', 'status=DELIVERED&pageSize=1&page=2', 'status=FAILED', 'status=RETRYING', 'status=nope&page=9&pageSize=0']) {
      await get(`${W}/deliveries?${query}`, A)
    }

    // Another restaurant has no webhook
    await p.req('signup start', 'POST', `${P}/signup/start`, { body: { email: 'owner@bbq.pk' } })
    const verified = await p.req('signup verify', 'POST', `${P}/signup/verify`, { body: { email: 'owner@bbq.pk', code: '123456' } })
    p.tokens.bbq = verified.get('data.session.accessToken')
    await get(W, { as: 'bbq' })
    await get(`${W}/deliveries`, { as: 'bbq' })

    if (process.env.GM_SHOW) require('node:fs').writeFileSync(process.env.GM_SHOW, p.statuses.join('\n'))
    expect(p.differences, p.report()).toEqual([])
  }, 180_000)
})
